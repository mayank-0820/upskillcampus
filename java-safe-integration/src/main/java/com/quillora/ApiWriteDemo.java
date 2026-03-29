package com.quillora;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public class ApiWriteDemo {
  public static void main(String[] args) throws Exception {
    String apiBase = env("CMS_API_BASE", "http://localhost:5002");
    String email = "mayank3847283@gmail.com";
    String password = "zoygogdlnyohunxy";

    if (email.isBlank() || password.isBlank()) {
      throw new IllegalArgumentException("Set CMS_API_EMAIL and CMS_API_PASSWORD first.");
    }

    HttpClient client = HttpClient.newHttpClient();
    ObjectMapper mapper = new ObjectMapper();

    String loginBody = mapper.createObjectNode()
      .put("email", email)
      .put("password", password)
      .toString();

    HttpRequest loginReq = HttpRequest.newBuilder()
      .uri(URI.create(apiBase + "/login"))
      .header("Content-Type", "application/json")
      .POST(HttpRequest.BodyPublishers.ofString(loginBody))
      .build();

    HttpResponse<String> loginRes = client.send(loginReq, HttpResponse.BodyHandlers.ofString());
    ensureOk(loginRes, "Login failed");
    JsonNode loginJson = mapper.readTree(loginRes.body());
    String token = loginJson.path("token").asText();
    if (token.isBlank()) throw new IllegalStateException("No token received from /login");

    String title = "Java API Post " + Instant.now();
    String content = "<p>Created from Java using the safe path (Node API).</p>";
    String createBody = mapper.createObjectNode()
      .put("title", title)
      .put("content", content)
      .toString();

    HttpRequest createReq = HttpRequest.newBuilder()
      .uri(URI.create(apiBase + "/posts"))
      .header("Content-Type", "application/json")
      .header("Authorization", "Bearer " + token)
      .POST(HttpRequest.BodyPublishers.ofString(createBody))
      .build();

    HttpResponse<String> createRes = client.send(createReq, HttpResponse.BodyHandlers.ofString());
    ensureOk(createRes, "Create post failed");
    System.out.println("Create response: " + createRes.body());
  }

  private static void ensureOk(HttpResponse<String> response, String message) {
    int status = response.statusCode();
    if (status >= 200 && status < 300) return;
    throw new IllegalStateException(message + " (" + status + "): " + response.body());
  }

  private static String env(String key, String defaultValue) {
    String value = System.getenv(key);
    return value == null || value.isBlank() ? defaultValue : value;
  }
}
