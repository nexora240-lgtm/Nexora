let host = location.protocol + "//" + location.host;

let _CONFIG = {
  wispurl:
    localStorage.getItem("proxServer") ||
    (location.protocol === "https:" ? "wss://" : "ws://") +
      location.host +
      "/wisp/",
  bareurl: host + "/bare/",
  // Views API Configuration - Replace with your AWS API Gateway URL
  viewsApiUrl: "https://2zpvhn3woh.execute-api.us-east-2.amazonaws.com",
  // Auth API Configuration - User authentication and data sync
  authApiUrl: "https://2zpvhn3woh.execute-api.us-east-2.amazonaws.com"
};
