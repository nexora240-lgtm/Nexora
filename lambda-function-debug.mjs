import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "nexora-game-views";

// CORS headers
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

export const handler = async (event) => {
  console.log("========== START REQUEST ==========");
  console.log("Event:", JSON.stringify(event, null, 2));

  // Handle OPTIONS for CORS preflight
  if (event.httpMethod === "OPTIONS" || event.requestContext?.http?.method === "OPTIONS") {
    console.log("CORS preflight request");
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  try {
    const path = event.path || event.rawPath || "";
    const method = event.httpMethod || event.requestContext?.http?.method || "GET";
    
    console.log("Method:", method);
    console.log("Path:", path);

    // POST /views/increment - Increment view count
    if (method === "POST" && path.includes("/views/increment")) {
      console.log("=== INCREMENT VIEW ===");
      const body = JSON.parse(event.body || "{}");
      const gameId = body.gameId || body.gameTitle;
      
      console.log("Request body:", body);
      console.log("Game ID:", gameId);

      if (!gameId) {
        console.log("ERROR: No gameId provided");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "gameId or gameTitle is required" })
        };
      }

      const params = {
        TableName: TABLE_NAME,
        Key: { gameId },
        UpdateExpression: "SET viewCount = if_not_exists(viewCount, :zero) + :inc, lastViewed = :now, likeCount = if_not_exists(likeCount, :zero), dislikeCount = if_not_exists(dislikeCount, :zero)",
        ExpressionAttributeValues: {
          ":inc": 1,
          ":zero": 0,
          ":now": new Date().toISOString()
        },
        ReturnValues: "ALL_NEW"
      };

      console.log("DynamoDB UpdateCommand params:", JSON.stringify(params, null, 2));
      
      try {
        const result = await ddb.send(new UpdateCommand(params));
        console.log("DynamoDB response:", JSON.stringify(result, null, 2));

        const response = {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            gameId,
            viewCount: result.Attributes.viewCount,
            likeCount: result.Attributes.likeCount,
            dislikeCount: result.Attributes.dislikeCount
          })
        };
        
        console.log("Returning response:", JSON.stringify(response, null, 2));
        return response;
      } catch (dbError) {
        console.error("DynamoDB Error:", dbError);
        throw dbError;
      }
    }

    // POST /likes/increment - Increment like count
    if (method === "POST" && path.includes("/likes/increment")) {
      console.log("=== INCREMENT LIKE ===");
      const body = JSON.parse(event.body || "{}");
      const gameId = body.gameId || body.gameTitle;
      const previousVote = body.previousVote || null;
      
      console.log("Game ID:", gameId);
      console.log("Previous vote:", previousVote);

      if (!gameId) {
        console.log("ERROR: No gameId provided");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "gameId or gameTitle is required" })
        };
      }

      const params = {
        TableName: TABLE_NAME,
        Key: { gameId },
        UpdateExpression: previousVote === 'dislike'
          ? "SET lastUpdated = :now ADD likeCount :inc, dislikeCount :dec"
          : "SET lastUpdated = :now ADD likeCount :inc",
        ExpressionAttributeValues: previousVote === 'dislike'
          ? {
              ":inc": 1,
              ":dec": -1,
              ":now": new Date().toISOString()
            }
          : {
              ":inc": 1,
              ":now": new Date().toISOString()
            },
        ReturnValues: "ALL_NEW"
      };

      console.log("DynamoDB UpdateCommand params:", JSON.stringify(params, null, 2));
      
      try {
        const result = await ddb.send(new UpdateCommand(params));
        console.log("DynamoDB response:", JSON.stringify(result, null, 2));

        const response = {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            gameId,
            likeCount: result.Attributes.likeCount,
            dislikeCount: result.Attributes.dislikeCount ?? 0
          })
        };
        
        console.log("Returning response:", JSON.stringify(response, null, 2));
        return response;
      } catch (dbError) {
        console.error("DynamoDB Error:", dbError);
        throw dbError;
      }
    }

    // POST /dislikes/increment - Increment dislike count
    if (method === "POST" && path.includes("/dislikes/increment")) {
      console.log("=== INCREMENT DISLIKE ===");
      const body = JSON.parse(event.body || "{}");
      const gameId = body.gameId || body.gameTitle;
      const previousVote = body.previousVote || null;
      
      console.log("Game ID:", gameId);
      console.log("Previous vote:", previousVote);

      if (!gameId) {
        console.log("ERROR: No gameId provided");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "gameId or gameTitle is required" })
        };
      }

      const params = {
        TableName: TABLE_NAME,
        Key: { gameId },
        UpdateExpression: previousVote === 'like'
          ? "SET lastUpdated = :now ADD dislikeCount :inc, likeCount :dec"
          : "SET lastUpdated = :now ADD dislikeCount :inc",
        ExpressionAttributeValues: previousVote === 'like'
          ? {
              ":inc": 1,
              ":dec": -1,
              ":now": new Date().toISOString()
            }
          : {
              ":inc": 1,
              ":now": new Date().toISOString()
            },
        ReturnValues: "ALL_NEW"
      };

      console.log("DynamoDB UpdateCommand params:", JSON.stringify(params, null, 2));
      
      try {
        const result = await ddb.send(new UpdateCommand(params));
        console.log("DynamoDB response:", JSON.stringify(result, null, 2));

        const response = {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            gameId,
            likeCount: result.Attributes.likeCount ?? 0,
            dislikeCount: result.Attributes.dislikeCount
          })
        };
        
        console.log("Returning response:", JSON.stringify(response, null, 2));
        return response;
      } catch (dbError) {
        console.error("DynamoDB Error:", dbError);
        throw dbError;
      }
    }

    // GET /views/{gameId} - Get view count for specific game
    if (method === "GET" && path.includes("/views/")) {
      console.log("=== GET VIEW COUNT ===");
      
      // Try multiple ways to get gameId
      let gameId = event.pathParameters?.gameId;
      
      if (!gameId) {
        const pathParts = path.split("/views/");
        gameId = pathParts.length > 1 ? decodeURIComponent(pathParts[1]) : null;
      }
      
      console.log("Raw path:", path);
      console.log("pathParameters:", event.pathParameters);
      console.log("Extracted gameId:", gameId);

      if (!gameId) {
        console.log("ERROR: No gameId found");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "gameId is required" })
        };
      }

      const params = {
        TableName: TABLE_NAME,
        Key: { gameId }
      };

      console.log("DynamoDB GetCommand params:", JSON.stringify(params, null, 2));

      try {
        const result = await ddb.send(new GetCommand(params));
        console.log("DynamoDB response:", JSON.stringify(result, null, 2));

        if (!result.Item) {
          console.log("No item found, returning zeros");
          const response = {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              gameId,
              viewCount: 0,
              likeCount: 0,
              dislikeCount: 0
            })
          };
          console.log("Returning response:", JSON.stringify(response, null, 2));
          return response;
        }

        const response = {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            gameId,
            viewCount: result.Item.viewCount || 0,
            likeCount: result.Item.likeCount || 0,
            dislikeCount: result.Item.dislikeCount || 0,
            lastViewed: result.Item.lastViewed
          })
        };
        
        console.log("Returning response:", JSON.stringify(response, null, 2));
        return response;
      } catch (dbError) {
        console.error("DynamoDB Error:", dbError);
        console.error("Error details:", JSON.stringify(dbError, null, 2));
        throw dbError;
      }
    }

    // POST /views/batch - Get multiple view counts at once
    if (method === "POST" && path.includes("/batch")) {
      console.log("=== BATCH GET ===");
      const body = JSON.parse(event.body || "{}");
      const gameIds = body.gameIds || [];
      
      console.log("Request body:", body);
      console.log("Game IDs:", gameIds);

      if (!Array.isArray(gameIds) || gameIds.length === 0) {
        console.log("ERROR: Invalid or empty gameIds array");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "gameIds array is required" })
        };
      }

      console.log(`Fetching ${gameIds.length} games...`);

      const promises = gameIds.map(async (gameId, index) => {
        try {
          console.log(`[${index + 1}/${gameIds.length}] Fetching: ${gameId}`);
          const result = await ddb.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { gameId }
          }));
          
          const data = {
            gameId,
            viewCount: result.Item?.viewCount || 0,
            likeCount: result.Item?.likeCount || 0,
            dislikeCount: result.Item?.dislikeCount || 0
          };
          
          console.log(`[${index + 1}/${gameIds.length}] Result:`, data);
          return data;
        } catch (err) {
          console.error(`Error fetching ${gameId}:`, err);
          return { 
            gameId, 
            viewCount: 0,
            likeCount: 0,
            dislikeCount: 0
          };
        }
      });

      const results = await Promise.all(promises);
      console.log("All results fetched:", results.length);
      
      const statsMap = {};
      results.forEach(r => {
        statsMap[r.gameId] = {
          viewCount: r.viewCount,
          likeCount: r.likeCount,
          dislikeCount: r.dislikeCount
        };
      });

      const response = {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          stats: statsMap
        })
      };
      
      console.log("Returning response with", Object.keys(statsMap).length, "games");
      return response;
    }

    // Default: Method not allowed
    console.log("ERROR: No matching route");
    console.log("Available routes: POST /views/increment, POST /likes/increment, POST /dislikes/increment, GET /views/{gameId}, POST /views/batch");
    
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        error: "Method not allowed",
        method,
        path,
        availableRoutes: [
          "POST /views/increment",
          "POST /likes/increment", 
          "POST /dislikes/increment",
          "GET /views/{gameId}",
          "POST /views/batch"
        ]
      })
    };

  } catch (error) {
    console.error("========== ERROR ==========");
    console.error("Error type:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Full error:", JSON.stringify(error, null, 2));
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
        type: error.name
      })
    };
  } finally {
    console.log("========== END REQUEST ==========");
  }
};
