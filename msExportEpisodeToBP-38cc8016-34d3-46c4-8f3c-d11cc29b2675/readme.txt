------------------------------------------------------------------------
Credenciais BP
------------------------------------------------------------------------
{
    client_id: bpuser,
    client_secret: t5+rlz4Pros2
}

------------------------------------------------------------------------
Conversão das Credenciais BP
------------------------------------------------------------------------
Base64(client_id:client_secret) => hash
Ex: Base64(bpuser:t5+rlz4Pros2) => Basic YnB1c2VyOnQ1K3JsejRQcm9zMg==

------------------------------------------------------------------------
Autorização
------------------------------------------------------------------------

requisicao: {
    Method: GET,
    Url: https://urwvkr5a42.execute-api.us-east-1.amazonaws.com/development/token,
    Headers: {
        "Authorization": "Basic YnB1c2VyOnQ1K3JsejRQcm9zMg=="
    }
}

resposta: {
    "access_token": "eyJraWQiOiJtdStJc1hRdm1LN0ZKRjdrbHpDeFVhbjNscU4wSk4wRTc4S2Y0RWJodWp3PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiI1N2NiNDliYy01ZDk3LTQ4NmItOGRhMC1lNzM3N2Y3NDI0NDUiLCJhdWQiOiIydmdiamR2OHU0bGdlbWNyOXNnMnA5NmM2YyIsImV2ZW50X2lkIjoiY2Q5Zjc1M2YtOTYwYy00NWNjLTljNTItYTliYjNiZWVmOGM3IiwidG9rZW5fdXNlIjoiaWQiLCJhdXRoX3RpbWUiOjE2Mzg3MzU5NTYsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC51cy1lYXN0LTEuYW1hem9uYXdzLmNvbVwvdXMtZWFzdC0xX25DcDRJSU42TCIsImNvZ25pdG86dXNlcm5hbWUiOiJicHVzZXIiLCJleHAiOjE2Mzg3Mzk1NTYsImlhdCI6MTYzODczNTk1Nn0.Ao-Vn0C2C1I3rn86S2AeqRE1SEv5XQuhwI5UaCmwbyj3mJEIafbhRLGrMZ4yd7pSUnElbrt6pjH-Kt5NzwZKfa0GHnfiRMzNDVYCZX5Kyh1SwHioqvjXA_Kz1Vxb8_PJmaMZjDpdeW8ma4H6zj8c9WOSEvUntQ2xy-XLzL7n4qwtTboBbp67tQVWasJcqwjNGklDPGgaMcHS-MJQ-kS4m1cpyIAPBOgH2BzzSAI82uOeKZi2P-oDy2nvylG3SHbbYysTJd_Qpdb95xPQRGFxbXlzZBteZlPWBIq4CAKed2thexKoGVc-UgSwyTmBxHxAVPeXUm94k_1vI5FUFGZbsw",
    "token_type": "bearer",
    "expires_in": 3600,
    "scope": "read"
}


------------------------------------------------------------------------
Push notification
------------------------------------------------------------------------

requisicao: {
    Method: POST,
    Url: https://v51z3whrql.execute-api.us-east-1.amazonaws.com/development/event,
    Headers: {
        "Authorization": "Bearer eyJraWQiOiJtdStJc1hRdm1LN0ZKRjdrbHpDeFVhbjNscU4wSk4wRTc4S2Y0RWJodWp3PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiI1N2NiNDliYy01ZDk3LTQ4NmItOGRhMC1lNzM3N2Y3NDI0NDUiLCJhdWQiOiIydmdiamR2OHU0bGdlbWNyOXNnMnA5NmM2YyIsImV2ZW50X2lkIjoiY2Q5Zjc1M2YtOTYwYy00NWNjLTljNTItYTliYjNiZWVmOGM3IiwidG9rZW5fdXNlIjoiaWQiLCJhdXRoX3RpbWUiOjE2Mzg3MzU5NTYsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC51cy1lYXN0LTEuYW1hem9uYXdzLmNvbVwvdXMtZWFzdC0xX25DcDRJSU42TCIsImNvZ25pdG86dXNlcm5hbWUiOiJicHVzZXIiLCJleHAiOjE2Mzg3Mzk1NTYsImlhdCI6MTYzODczNTk1Nn0.Ao-Vn0C2C1I3rn86S2AeqRE1SEv5XQuhwI5UaCmwbyj3mJEIafbhRLGrMZ4yd7pSUnElbrt6pjH-Kt5NzwZKfa0GHnfiRMzNDVYCZX5Kyh1SwHioqvjXA_Kz1Vxb8_PJmaMZjDpdeW8ma4H6zj8c9WOSEvUntQ2xy-XLzL7n4qwtTboBbp67tQVWasJcqwjNGklDPGgaMcHS-MJQ-kS4m1cpyIAPBOgH2BzzSAI82uOeKZi2P-oDy2nvylG3SHbbYysTJd_Qpdb95xPQRGFxbXlzZBteZlPWBIq4CAKed2thexKoGVc-UgSwyTmBxHxAVPeXUm94k_1vI5FUFGZbsw"
    }
}

------------------------------------------------------------------------
Obter dados do paciente
------------------------------------------------------------------------

requisicao: {
    Method: GET,
    Url: https://v51z3whrql.execute-api.us-east-1.amazonaws.com/development/fhir/v2?identifier=./NamingSystem/cartao_plano_saude/5468300010001008118,
    Headers: {
        "Authorization": "Bearer eyJraWQiOiJtdStJc1hRdm1LN0ZKRjdrbHpDeFVhbjNscU4wSk4wRTc4S2Y0RWJodWp3PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiI1N2NiNDliYy01ZDk3LTQ4NmItOGRhMC1lNzM3N2Y3NDI0NDUiLCJhdWQiOiIydmdiamR2OHU0bGdlbWNyOXNnMnA5NmM2YyIsImV2ZW50X2lkIjoiY2Q5Zjc1M2YtOTYwYy00NWNjLTljNTItYTliYjNiZWVmOGM3IiwidG9rZW5fdXNlIjoiaWQiLCJhdXRoX3RpbWUiOjE2Mzg3MzU5NTYsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC51cy1lYXN0LTEuYW1hem9uYXdzLmNvbVwvdXMtZWFzdC0xX25DcDRJSU42TCIsImNvZ25pdG86dXNlcm5hbWUiOiJicHVzZXIiLCJleHAiOjE2Mzg3Mzk1NTYsImlhdCI6MTYzODczNTk1Nn0.Ao-Vn0C2C1I3rn86S2AeqRE1SEv5XQuhwI5UaCmwbyj3mJEIafbhRLGrMZ4yd7pSUnElbrt6pjH-Kt5NzwZKfa0GHnfiRMzNDVYCZX5Kyh1SwHioqvjXA_Kz1Vxb8_PJmaMZjDpdeW8ma4H6zj8c9WOSEvUntQ2xy-XLzL7n4qwtTboBbp67tQVWasJcqwjNGklDPGgaMcHS-MJQ-kS4m1cpyIAPBOgH2BzzSAI82uOeKZi2P-oDy2nvylG3SHbbYysTJd_Qpdb95xPQRGFxbXlzZBteZlPWBIq4CAKed2thexKoGVc-UgSwyTmBxHxAVPeXUm94k_1vI5FUFGZbsw"
    }
}
