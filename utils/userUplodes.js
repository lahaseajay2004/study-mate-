const multer = require("multer");
const fs = require("fs");
const path = require("path");

function createUpload(type, fileType) {

  const storage = multer.diskStorage({

    destination: function (req, file, cb) {

      const userId = req.cookies.playerId || "guest";

      const base = path.join(
        "database",
        "uploads",
        "users",
        userId,
        type,
        fileType
      );

      fs.mkdirSync(base, { recursive: true });

      cb(null, base);
    },

    filename: function (req, file, cb) {

      const ext = path.extname(file.originalname);

      const name =
        Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;

      cb(null, name);
    }

  });

  return multer({ storage });
}

module.exports = { createUpload };