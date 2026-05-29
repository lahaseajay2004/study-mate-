function getUserId(req) {
  return (
    req.session?.user?.id ||
    req.session?.userId ||
    null
  );
}


module.exports = { getUserId };