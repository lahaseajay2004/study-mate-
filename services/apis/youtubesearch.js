const axios = require("axios");

const API_KEY = process.env.YOUTUBE_API_KEY;

async function searchYouTube(query){

  console.log("YT QUERY:", query);

  try{

    const url = "https://www.googleapis.com/youtube/v3/search";

    const res = await axios.get(url,{
      params:{
        key: API_KEY,
        part: "snippet",
        q: query,
        maxResults: 8,
        type: "video"
      }
    });

    const videos = res.data.items.map(v => ({
      title: v.snippet.title,
      videoId: v.id.videoId,
      url: `https://youtube.com/watch?v=${v.id.videoId}`,
      thumbnail: v.snippet.thumbnails.medium.url,
      channel: v.snippet.channelTitle
    }));

    console.log("VIDEOS FOUND:", videos.length);

    return videos;

  }catch(err){

    console.log("YT API ERROR:", err.response?.data || err.message);
    return [];

  }

}

module.exports = { searchYouTube };