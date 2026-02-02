Feature: MockMail platform availability and core behavior
  As an operator
  I want to verify availability and core API behavior
  So that I can detect outages quickly

  Background:
    Given the API base is "https://api.mockmail.dev"
    And the Watch base is "https://watch.mockmail.dev"

  Scenario: Watch dashboard is reachable
    When I GET "/" on the Watch base
    Then the response status should be 200

  Scenario: API health endpoint
    When I GET "/api/health" on the API base
    Then the response status should be 200
    And the JSON should contain key "status" with value "healthy" or "unhealthy"

  Scenario: Successful login (with valid credentials)
    Given valid credentials
    When I POST "/api/auth/login" with email and password
    Then the response status should be 200
    And the JSON should contain key "token"

  Scenario: Email process validation
    Given an authorization token
    When I POST "/api/mail/process" with an empty JSON body
    Then the response status should be 400
    And the JSON should mention validation errors

  Scenario: HTTP to HTTPS redirect
    When I GET "http://api.mockmail.dev/api/auth/login"
    Then the response status should be 301
