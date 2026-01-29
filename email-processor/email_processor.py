#!/usr/bin/env python3

import os
import json
import logging
from logging.handlers import RotatingFileHandler
import select
import html
import chardet
from email import message_from_string
from email.policy import default
from bs4 import BeautifulSoup
from contextlib import contextmanager
import time
from datetime import datetime
import requests

# Configurações
FIFO_PATH = "/var/spool/email-processor"
OUTPUT_FILE = "/var/log/mockmail/emails.json"
LOG_FILE = "/var/log/mockmail/email_processor.log"
POLL_TIMEOUT = 1000  # timeout em milissegundos

# Configurações de autenticação - CORRIGIDAS
API_BASE_URL = "https://api.mockmail.dev"
SYSTEM_EMAIL = "system@mockmail.dev"
SYSTEM_PASSWORD = "MockMail@2025"
token_cache = {"token": None, "expires": 0}

# Configuração do Logger com rotação de arquivos
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        RotatingFileHandler(
            LOG_FILE,
            maxBytes=10485760,  # 10MB
            backupCount=5
        ),
        logging.StreamHandler()
    ]
)

def get_auth_token():
    """
    Obtém ou renova o token de autenticação JWT.
    
    Returns:
        str: Token JWT válido
    """
    global token_cache
    
    # Verifica se o token ainda é válido (com margem de 5 minutos)
    if token_cache.get("token") and time.time() < token_cache.get("expires", 0) - 300:
        return token_cache["token"]
    
    try:
        login_url = f"{API_BASE_URL}/api/auth/login"
        response = requests.post(login_url, json={
            "email": SYSTEM_EMAIL,
            "password": SYSTEM_PASSWORD
        })
        response.raise_for_status()
        
        token_data = response.json()
        token_cache["token"] = token_data["token"]
        # JWT válido por 24 horas
        token_cache["expires"] = time.time() + 86400
        
        logging.info("Token de autenticação renovado com sucesso")
        return token_cache["token"]
        
    except requests.exceptions.RequestException as e:
        raise Exception(f"Erro ao obter token de autenticação: {str(e)}")

def decode_text(text, charset=None):
    """
    Decodifica texto considerando diferentes codificações.
    
    Args:
        text (bytes or str): Texto para decodificar
        charset (str): Charset sugerido pelo email
    
    Returns:
        str: Texto decodificado
    """
    if isinstance(text, str):
        return text

    if not charset:
        # Detecta a codificação se não for fornecida
        detected = chardet.detect(text)
        charset = detected['encoding']

    try:
        # Tenta decodificar com a codificação detectada/fornecida
        return text.decode(charset or 'utf-8', errors='replace')
    except (UnicodeDecodeError, AttributeError):
        # Fallback para utf-8 em caso de erro
        return text.decode('utf-8', errors='replace')

def clean_html(html_content):
    """
    Remove tags HTML mantendo apenas o texto.
    
    Args:
        html_content (str): Conteúdo HTML
    
    Returns:
        str: Texto limpo
    """
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        # Remove scripts e estilos
        for script in soup(["script", "style"]):
            script.decompose()
        return soup.get_text(separator=' ', strip=True)
    except Exception as e:
        logging.warning(f"Erro ao limpar HTML: {e}")
        return html.unescape(html_content)

def parse_email(raw_email):
    """
    Transforma o e-mail bruto em um dicionário JSON com tratamento melhorado.
    
    Args:
        raw_email (str): Conteúdo bruto do email
        
    Returns:
        dict: Email parseado em formato de dicionário
    """
    try:
        email_message = message_from_string(raw_email, policy=default)
        body = ""
        content_type = ""
        
        # Processa o corpo do email
        if email_message.is_multipart():
            for part in email_message.walk():
                if part.get_content_maintype() == 'text':
                    charset = part.get_content_charset()
                    payload = part.get_payload(decode=True)
                    
                    if payload:
                        decoded_text = decode_text(payload, charset)
                        content_type = part.get_content_type()
                        # Desabilitar html por enquanto
                        if content_type == 'text/html-1':
                            body = clean_html(decoded_text)
                        else:
                            body = decoded_text
                        break
        else:
            charset = email_message.get_content_charset()
            payload = email_message.get_payload(decode=True)
            content_type = email_message.get_content_type()
            
            if payload:
                decoded_text = decode_text(payload, charset)
                if content_type == 'text/html':
                    body = clean_html(decoded_text)
                else:
                    body = decoded_text

        parsed_email = {
            "id": email_message.get("Message-ID", ""),
            "subject": decode_text(email_message.get("Subject", "")),
            "from": decode_text(email_message.get("From", "")),
            "to": decode_text(email_message.get("To", "")),
            "date": email_message.get("Date", ""),
            "content_type": content_type,
            "body": body.strip(),
            "processed_at": datetime.now().isoformat()
        }
        
        logging.info(f"E-mail processado com sucesso: {parsed_email['subject']}")
        return parsed_email
    except Exception as e:
        logging.error(f"Erro ao processar e-mail: {str(e)}")
        raise

def save_email(parsed_email):
    """
    Salva o email parseado em formato JSON com tratamento de erros melhorado.
    
    Args:
        parsed_email (dict): Email parseado para ser salvo
    """
    try:
        # Garante que o diretório existe
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        
        # Adiciona uma nova linha se o arquivo já existir
        new_line = not os.path.exists(OUTPUT_FILE) or os.path.getsize(OUTPUT_FILE) == 0
        
        with open(OUTPUT_FILE, "a", encoding='utf-8') as outfile:
            if not new_line:
                outfile.write("\n")
            json.dump(parsed_email, outfile, ensure_ascii=False, indent=None)
            
        logging.info(f"E-mail salvo em JSON com sucesso: {parsed_email['id']}")
    except Exception as e:
        logging.error(f"Erro ao salvar e-mail: {str(e)}")
        raise

def send_email_to_api(parsed_email: dict) -> dict:
    """
    Envia email parseado para API de processamento com autenticação.
    
    Args:
        parsed_email (dict): Dicionário com dados do email
        
    Returns:
        dict: Resposta da API
    """
    api_url = f"{API_BASE_URL}/api/mail/process"  # URL CORRIGIDA
    
    try:
        # Obtém token de autenticação
        token = get_auth_token()
        
        # Prepara headers com autenticação
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        }
        
        response = requests.post(api_url, json=parsed_email, headers=headers)
        response.raise_for_status()
        logging.info(f"Email enviado com sucesso para API!")
        logging.debug(f"Resposta recebida da API: {response.status_code}")
        return response.json()
        
    except requests.exceptions.RequestException as e:
        logging.error(f"Erro ao enviar email para API: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            logging.error(f"Status: {e.response.status_code}")
            logging.error(f"Response: {e.response.text}")
        raise Exception(f"Erro ao enviar email para API: {str(e)}")

def main():
    """Processa e-mails recebidos pelo FIFO."""
    logging.info(f"Iniciando monitoramento do FIFO em {FIFO_PATH}")
    
    while True:
        try:
            # Garante que o FIFO existe
            if not os.path.exists(FIFO_PATH):
                os.mkfifo(FIFO_PATH)
            
            # Abre o FIFO para leitura
            with open(FIFO_PATH, 'r') as fifo:
                raw_email = fifo.read()
                
                if raw_email.strip():  # Verifica se há conteúdo válido
                    parsed_email = parse_email(raw_email)
                    save_email(parsed_email)
                    send_email_to_api(parsed_email)
                else:
                    logging.debug("FIFO vazio ou apenas com espaços em branco")
                    
        except Exception as e:
            logging.error(f"Erro no processamento: {str(e)}")
            import time
            time.sleep(1)

if __name__ == "__main__":
    main()
