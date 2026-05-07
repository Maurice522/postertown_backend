export function notFound(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
}

export function errorHandler(error, req, res, next) {
  console.error(error);
  res.status(error.status ?? 500).json({
    message: error.message ?? "Internal server error"
  });
}
