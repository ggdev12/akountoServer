const OpenAI = require("openai");
require("dotenv").config();
const fs = require("fs");
const OAuthClient = require("intuit-oauth");
const { Integration } = require("../../db/models");
const redirectUri =
  process.env.quickbooksRedirectUri ||
  "http://localhost:4000/api/quickbooks/callback";
const oauthClient = new OAuthClient({
  clientId: process.env.quickbooksClientId,
  clientSecret: process.env.quickbooksClientSec,
  environment: "sandbox",
  redirectUri: redirectUri,
});

class AI {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.openaikey, // remove the fallback hardcoded key
    });
    this.analyzeInstructions = fs.readFileSync(
      __dirname + "/analyzeInstructions.md",
      "utf8",
    );
    this.extractInstructions = fs.readFileSync(
      __dirname + "/extractInstructions.md",
      "utf8",
    );
    this.invoiceJsonSchema = require("./schemas").invoiceJsonSchema;
    this.purchaseJsonSchema = require("./schemas").purchaseJsonSchema;
    this.quickbooksBaseUrl =
      "https://sandbox-quickbooks.api.intuit.com/v3/company";
    //this.quickbooksBaseUrl = 'https://quickbooks.api.intuit.com/v3/company';
  }

  async processDocument(images, jsonFormat) {
    console.log("raw json extracted");

    let processed_json = await this.extractJsonfromImage(images, jsonFormat);

    console.log("processed json : from open ai ");

    return {
      processed_json: JSON.parse(processed_json),
      raw_json: processed_json,
    };
  }

  async analyzeImages(images) {
    try {
      let messages = [
        {
          role: "user",
          content: [
            { type: "text", text: this.analyzeInstructions },
            ...images.map((image) => ({
              type: "image_url",
              image_url: {
                url: image,
              },
            })),
          ],
        },
      ];

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 2000,
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.log("error : ", error);
      console.error("Error analyzing image:");
      return false;
    }
  }

  async extractJson(document, schema) {
    console.log("document : ", document);

    let systemPrompt =
      "** Task: Convert raw json format into a structured JSON using the `create_invoice` function tool call **";

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: document,
        },
      ],
      temperature: 0,
      max_tokens: 2197,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      tool_choice: { type: "function", function: { name: "create_invoice" } },
      tools: [
        {
          type: "function",
          function: {
            name: "create_invoice",
            description:
              "Create a structured invoice or receipt from the raw json provided.",
            parameters: {
              type: "object",
              properties: schema,
            },
          },
        },
      ],
    });

    if (
      response &&
      response.choices &&
      response.choices.length > 0 &&
      response.choices[0].message &&
      response.choices[0].message.tool_calls &&
      response.choices[0].message.tool_calls.length > 0 &&
      response.choices[0].message.tool_calls[0].function
    ) {
      return response.choices[0].message.tool_calls[0].function.arguments;
    } else {
      return null;
    }
  }

  async extractJsonfromImage(images, schema) {
    console.log("images : ", images);

    let systemPrompt =
      "** Task: Convert raw json format into a structured JSON using the `create_invoice` function tool call **";
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: this.extractInstructions,
        },
        {
          role: "user",
          content: [
            { type: "text", text: this.analyzeInstructions },
            ...images.map((image) => ({
              type: "image_url",
              image_url: {
                url: image,
              },
            })),
          ],
        },
      ],
      temperature: 0,
      max_tokens: 2197,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      tool_choice: { type: "function", function: { name: "create_invoice" } },
      tools: [
        {
          type: "function",
          function: {
            name: "create_invoice",
            description:
              "Create a structured invoice or receipt from the document provided.",
            parameters: {
              type: "object",
              properties: schema,
            },
          },
        },
      ],
    });

    if (
      response &&
      response.choices &&
      response.choices.length > 0 &&
      response.choices[0].message &&
      response.choices[0].message.tool_calls &&
      response.choices[0].message.tool_calls.length > 0 &&
      response.choices[0].message.tool_calls[0].function
    ) {
      return response.choices[0].message.tool_calls[0].function.arguments;
    } else {
      return null;
    }
  }

  async getOAuthRedirectURL(state) {
    return oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
      state: state,
    });
  }

  async createToken(token) {
    return await oauthClient.createToken(token);
  }
  async refreshOrSetToken(config) {
    console.log("Entering refreshOrSetToken");
    console.log("Config:", JSON.stringify(config, null, 2));

    if (!config || !config.refresh_token) {
      console.error("Invalid config or missing refresh token");
      throw new Error("Invalid QuickBooks configuration");
    }

    oauthClient.setToken(config);
    const isValid = oauthClient.isAccessTokenValid();
    console.log("Is token valid:", isValid);

    try {
      if (!isValid) {
        console.log("Token is invalid, refreshing...");
        const authResponse = await oauthClient.refreshUsingToken(
          config.refresh_token,
        );

        const refreshToken = authResponse.json;
        console.log("refreshing ---------->>>>>", authResponse.json);
        const credentials = {
          realmId: config.realmId,
          token_type: refreshToken.token_type,
          access_token: refreshToken.access_token,
          expires_in: refreshToken.expires_in,
          x_refresh_token_expires_in: refreshToken.x_refresh_token_expires_in,
          refresh_token: refreshToken.refresh_token,
          id_token: config.id_token,
          latency: config.latency,
        };

        console.log(
          "Updated credentials:",
          JSON.stringify(credentials, null, 2),
        );

        oauthClient.setToken(credentials);
        return credentials;
      }
      return config;
    } catch (error) {
      console.error("Error in refreshOrSetToken:", error);
      throw new Error(`Failed to refresh QuickBooks token: ${error.message}`);
    }
  }
  async quickbooksQuery(realmId, query, config) {
    try {
      console.log("Entering quickbooksQuery");
      console.log("RealmId:", realmId);
      console.log("Query:", query);

      const updatedConfig = await this.refreshOrSetToken(config);

      const encodedQuery = encodeURIComponent(query);
      const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodedQuery}`;

      console.log("QuickBooks API URL:", url);

      oauthClient.setToken(updatedConfig);

      const response = await oauthClient.makeApiCall({
        url: url,
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      console.log("QuickBooks API Response received");
      return {
        status: "success",
        data: response.getJson().QueryResponse,
        query_execution_time:
          response.getHeaders()["x-execution-time"] || "N/A",
        row_count: response.getJson().QueryResponse.totalCount || 0,
      };
    } catch (error) {
      console.error("Error querying QuickBooks:", {
        message: error.message,
        response: error.response
          ? {
              status: error.response.status,
              data: error.response.data,
            }
          : "No response",
      });
      throw new Error(`QuickBooks query failed: ${error.message}`);
    }
  }

  async getAIPromptAnswer(prompt, realmId, accessToken, refreshToken) {
    try {
      console.log("Initiating AI prompt answer...");
      console.log("Prompt:", prompt);
      console.log("RealmId:", realmId);

      // Create a config object from the passed tokens
      const config = {
        realmId,
        access_token: accessToken,
        refresh_token: refreshToken,
      };

      // We don't need to fetch integration from the database anymore
      // as we're passing the necessary credentials directly

      console.log("Using RealmId:", realmId);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant that analyzes QuickBooks data and answers questions about it. You can use the quickbooks_fetch_data function to query QuickBooks data when needed. Always use proper SQL syntax for QuickBooks queries.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        tools: [
          {
            type: "function",
            function: {
              name: "quickbooks_fetch_data",
              description:
                "Fetch data from QuickBooks using a custom SQL query",
              parameters: {
                type: "object",
                required: ["sql_query"],
                properties: {
                  sql_query: {
                    type: "string",
                    description:
                      "The SQL query to execute against the QuickBooks database",
                  },
                  max_results: {
                    type: "integer",
                    default: 1000,
                    description:
                      "The maximum number of results to return (optional, default is 1000)",
                  },
                },
              },
            },
          },
        ],
      });

      console.log("OpenAI Response received.");

      let result = "";

      if (response.choices && response.choices.length > 0) {
        const choice = response.choices[0];
        if (choice.message.tool_calls) {
          for (const toolCall of choice.message.tool_calls) {
            if (toolCall.function.name === "quickbooks_fetch_data") {
              const args = JSON.parse(toolCall.function.arguments);
              let content = args.sql_query;
              console.log("SQL query for QuickBooks:", content);

              let quickbooksResponse;
              try {
                quickbooksResponse = await this.quickbooksQuery(
                  realmId,
                  content,
                  config,
                );
                console.log(
                  "QuickBooks Response:",
                  JSON.stringify(quickbooksResponse, null, 2),
                );
              } catch (error) {
                console.error("Error querying QuickBooks:", error);
                return {
                  error: "QuickBooks query failed",
                  message: `I encountered an error while trying to fetch data from QuickBooks. The error was: ${error.message}. Please ensure your QuickBooks integration is properly set up and try again later.`,
                };
              }

              const toolResponse = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                  { role: "user", content: prompt },
                  { role: "assistant", content: choice.message.content },
                  {
                    role: "function",
                    name: "quickbooks_fetch_data",
                    content: JSON.stringify(quickbooksResponse),
                  },
                ],
                temperature: 0.7,
                max_tokens: 1000,
              });

              result = toolResponse.choices[0].message.content;
            }
          }
        } else {
          result = choice.message.content;
        }
      } else {
        console.error("No response from OpenAI API");
        return {
          error: "No response from AI",
          message: "The AI model did not provide a response.",
        };
      }

      console.log("Final Result:", result);
      return result;
    } catch (error) {
      console.error("Error in getAIPromptAnswer:", error);
      return {
        error: "Internal server error",
        message: error.message,
        stack: error.stack,
      };
    }
  }
}

let images = [
  "https://sjc1.vultrobjects.com/kountofiles/processed/4948636466-b53fed83-51e6-4ead-9341-78c34a6879d0_page_1.jpeg",
  "https://sjc1.vultrobjects.com/kountofiles/processed/4948636466-b53fed83-51e6-4ead-9341-78c34a6879d0_page_2.jpeg",
];

module.exports = AI;
