import { connectDB } from "../lib/db.js";
import { getTransporter } from "../lib/mailer.js";
import Member from "../models/Member.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });
  try {
    await connectDB();
    const { fullName, name, mobile, email, aadhar = "", pan = "", project = "", paymentRef = "" } = req.body || {};
    const finalName = fullName || name;
    if (!finalName || !mobile || !email) return res.status(400).json({ ok:false, error:"Missing required fields" });

    // Save to MongoDB for records
    const saved = await Member.create({ fullName: finalName, mobile, email, aadhar, pan, project, paymentRef });

    // Also register in backend SQLite for authentication
    let memberId = "";
    let password = "";
    try {
      const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
      const response = await fetch(`${backendUrl}/api/pay/simulate-join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: "FWF Membership Details",
      text: `Dear ${finalName},\n\nYour membership is confirmed!\nMember ID: ${memberId}\n${password ? `Password: ${password}\n\nPlease change your password after first login.` : 'Password: (will be sent separately)'}\n\nThank you!\nFWF`
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.SMTP_USER,
      subject: `New Member: ${finalName} (${memberId})`,
      text: `Name: ${finalName}\nMobile: ${mobile}\nEmail: ${email}\nProject: ${project || "-"}\nPaymentRef: ${paymentRef || "-"}\nMember ID: ${memberId}\nPassword: ${password || "Not set"}`
    });

    return res.json({ ok:true, id: saved._id, memberId, password });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok:false, error:String(err) });
  }
}