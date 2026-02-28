import { connectDB } from "../lib/db.js";
import { sendMemberWelcome, getTransporter } from "../lib/mailer.js";
import Member from "../models/Member.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });
  try {
    await connectDB();
    const { fullName, name, mobile, email, aadhar = "", pan = "", project = "", paymentRef = "", paymentProof = "" } = req.body || {};
    const finalName = fullName || name;
    if (!finalName || !mobile || !email) return res.status(400).json({ ok:false, error:"Missing required fields" });

    // Save to MongoDB for records (including base64 payment proof)
    const saved = await Member.create({ fullName: finalName, mobile, email, aadhar, pan, project, paymentRef, paymentProof });

    // Also register in backend SQLite for authentication
    let memberId = "";
    let password = "";
    try {
      const backendUrl = process.env.BACKEND_URL || "https://fwf-production.up.railway.app";
      const internalKey = process.env.INTERNAL_API_KEY;
      const response = await fetch(`${backendUrl}/api/pay/simulate-join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(internalKey ? { "x-internal-api-key": internalKey } : {})
        },
        body: JSON.stringify({ name: finalName, mobile, email })
      });
      const data = await response.json();
      if (data.ok) {
        memberId = data.memberId;
        password = data.password;
      } else {
        // If backend registration fails, use MongoDB ID
        memberId = "FWF-" + saved._id.toString().slice(-6).toUpperCase();
      }
    } catch (backendErr) {
      console.error("Backend registration failed:", backendErr);
      // Fallback to MongoDB ID
      memberId = "FWF-" + saved._id.toString().slice(-6).toUpperCase();
    }

    // Send HTML welcome email with credentials
    sendMemberWelcome({ name: finalName, email, memberId, password, mobile })
      .then(() => console.log(`✅ Member welcome email sent → ${email}`))
      .catch(e => console.error('⚠️ Member welcome email failed:', e.message));

    // Admin notification (plain text)
    const transporter = getTransporter();
    transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.SMTP_USER,
      subject: `New Member: ${finalName} (${memberId})`,
      text: `New member registered via join form.\n\nName: ${finalName}\nMobile: ${mobile}\nEmail: ${email}\nProject: ${project || "-"}\nPaymentRef: ${paymentRef || "-"}\nMember ID: ${memberId}\nPassword: ${password || "Not set"}`
    }).catch(e => console.error('⚠️ Admin alert failed:', e.message));

    return res.json({ ok:true, id: saved._id, memberId, password });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok:false, error:String(err) });
  }
}