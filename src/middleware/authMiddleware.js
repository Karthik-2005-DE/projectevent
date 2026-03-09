import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  const cookieToken = req.cookies?.token;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({ message: "Not authorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.id;
    req.role = decoded.role;
    next();
  } catch (error) {
    res.status(401).json({ message: "Token invalid" });
  }
};
