import { connectDB } from "../lib/db.js";
import { getTransporter } from "../lib/mailer.js";
import { withSentry } from "../lib/sentry.js";
import Contact from "../models/Contact.js";

export default withSentry(async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });
  
  await connectDB();
  const { name, email, phone = "", message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ ok:false, error:"Missing required fields" });
  const saved = await Contact.create({ name, email, phone, message });

  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: process.env.SMTP_USER,
    subject: `New Contact: ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || "-"}\n\nMessage:\n${message}`
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Thanks for contacting FWF",
    text: `Hi ${name},\n\nThanks for reaching out! Our team will get back to you shortly.\n\nRegards,\nFWF`
  });

  return res.json({ ok:true, id: saved._id });
});