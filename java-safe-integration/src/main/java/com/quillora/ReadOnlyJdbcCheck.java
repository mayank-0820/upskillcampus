package com.quillora;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

public class ReadOnlyJdbcCheck {
  public static void main(String[] args) throws Exception {
    String host = env("CMS_DB_HOST", "localhost");
    String port = env("CMS_DB_PORT", "5002");
    String db = env("CMS_DB_NAME", "quillora_db");
    String user = env("CMS_DB_USER", "root");
    String pass = env("CMS_DB_PASS", "");

    String params = "useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=UTC";
    String jdbcUrl = "jdbc:mysql://" + host + ":" + port + "/" + db + "?" + params;

    String sql = "SELECT id, title, author_email, created_at FROM posts ORDER BY created_at DESC LIMIT 10";

    try (Connection conn = DriverManager.getConnection(jdbcUrl, user, pass);
         PreparedStatement ps = conn.prepareStatement(sql);
         ResultSet rs = ps.executeQuery()) {
      System.out.println("Connected to " + jdbcUrl);
      System.out.println("Latest posts:");
      while (rs.next()) {
        System.out.printf(
          "- #%d | %s | %s | %s%n",
          rs.getInt("id"),
          rs.getString("title"),
          rs.getString("author_email"),
          rs.getTimestamp("created_at")
        );
      }
    }
  }

  private static String env(String key, String defaultValue) {
    String value = System.getenv(key);
    return value == null || value.isBlank() ? defaultValue : value;
  }
}
