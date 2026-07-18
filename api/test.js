export default function handler(req, res) {
  res.json({ ok: true, node: process.version, type: typeof require })
}
