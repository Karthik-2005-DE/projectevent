import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    req.role = decoded.role;

    next();

  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};
export const adminOnly = (req, res, next) => {
  const role = req.user?.role || req.role;

  if (role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  next();
};
