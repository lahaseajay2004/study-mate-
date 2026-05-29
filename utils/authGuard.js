module.exports = (req, res, next) => {
  if (!req.session.user || !req.session.user.id) {
    return res.redirect("/auth/login");
  }
  next();
};