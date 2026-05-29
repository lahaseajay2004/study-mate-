const express = require("express");
const router = express.Router();
const authGuard = require("../utils/authGuard");
const { searchApis } = require("../services/apis/apiHub");
const { getHistory } = require("../services/apis/apiHub");

router.get("/search",authGuard, (req, res) => {
  res.render("apiTest", { results: [], history: getHistory() });
});

router.post("/search",authGuard, async (req, res) => {
  const { query } = req.body;

  const selectedApis = {
    wikipedia: !!req.body.wikipedia,
    wikidata: !!req.body.wikidata,
    openalex: !!req.body.openalex,
    duckduckgo: !!req.body.duckduckgo
  };

  const results = await searchApis(query, selectedApis);

  res.render("apiTest", {
    results,
    history: getHistory()
  });
});

module.exports = router;
