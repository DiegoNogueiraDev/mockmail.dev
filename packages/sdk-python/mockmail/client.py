import time
import re
from typing import Optional, Dict, Any, List
import requests


class MockMailError(Exception):
    def __init__(self, message: str, status_code: int, response: Any):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class _HttpClient:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "X-API-Key": api_key,
        })

    def request(self, method: str, path: str, **kwargs) -> Dict:
        url = f"{self.base_url}/api{path}"
        resp = self.session.request(method, url, **kwargs)
        data = resp.json() if resp.content else {}
        if not resp.ok:
            raise MockMailError(
                data.get("message", f"HTTP {resp.status_code}"),
                resp.status_code,
                data,
            )
        return data


class _Boxes:
    def __init__(self, http: _HttpClient):
        self._http = http

    def create(self, custom_name: Optional[str] = None) -> Dict:
        body = {"customName": custom_name} if custom_name else {}
        return self._http.request("POST", "/boxes", json=body).get("data", {})

    def list(self, page: int = 1, limit: int = 20) -> Dict:
        return self._http.request("GET", f"/boxes?page={page}&limit={limit}")

    def get(self, box_id: str) -> Dict:
        return self._http.request("GET", f"/boxes/{box_id}").get("data", {})

    def delete(self, box_id: str) -> None:
        self._http.request("DELETE", f"/boxes/{box_id}")

    def clear(self, box_id: str) -> None:
        self._http.request("POST", f"/boxes/{box_id}/clear")


class _Emails:
    def __init__(self, http: _HttpClient):
        self._http = http

    def list(self, page: int = 1, limit: int = 20, search: Optional[str] = None) -> Dict:
        qs = f"?page={page}&limit={limit}"
        if search:
            qs += f"&search={requests.utils.quote(search)}"
        return self._http.request("GET", f"/mail/emails{qs}")

    def get(self, email_id: str) -> Dict:
        return self._http.request("GET", f"/mail/emails/{email_id}").get("data", {})

    def latest(self, box_address: str) -> Dict:
        return self._http.request("GET", f"/mail/latest/{requests.utils.quote(box_address)}").get("data", {})

    def latest_by_subject(self, box_address: str, subject: str) -> Dict:
        return self._http.request(
            "GET",
            f"/mail/latest/{requests.utils.quote(box_address)}/subject/{requests.utils.quote(subject)}",
        ).get("data", {})

    def delete(self, email_id: str) -> None:
        self._http.request("DELETE", f"/mail/emails/{email_id}")

    def forward(self, email_id: str, forward_to: str) -> None:
        self._http.request("POST", f"/mail/emails/{email_id}/forward", json={"forwardTo": forward_to})

    def wait_for(
        self,
        box_address: str,
        subject: Optional[str] = None,
        from_addr: Optional[str] = None,
        timeout: int = 30000,
        interval: int = 2000,
    ) -> Dict:
        start = time.time() * 1000
        while (time.time() * 1000 - start) < timeout:
            try:
                email = self.latest(box_address)
                if not email:
                    time.sleep(interval / 1000)
                    continue
                if subject and subject not in email.get("subject", ""):
                    time.sleep(interval / 1000)
                    continue
                if from_addr and from_addr not in email.get("from", ""):
                    time.sleep(interval / 1000)
                    continue
                return email
            except Exception:
                time.sleep(interval / 1000)
        raise TimeoutError(f"Timeout waiting for email at {box_address} after {timeout}ms")


class _Webhooks:
    def __init__(self, http: _HttpClient):
        self._http = http

    def list(self, page: int = 1, limit: int = 20) -> Dict:
        return self._http.request("GET", f"/webhooks?page={page}&limit={limit}")

    def create(self, name: str, url: str, events: List[str]) -> Dict:
        return self._http.request("POST", "/webhooks", json={"name": name, "url": url, "events": events}).get("data", {})

    def get(self, webhook_id: str) -> Dict:
        return self._http.request("GET", f"/webhooks/{webhook_id}").get("data", {})

    def update(self, webhook_id: str, **kwargs) -> Dict:
        return self._http.request("PUT", f"/webhooks/{webhook_id}", json=kwargs).get("data", {})

    def delete(self, webhook_id: str) -> None:
        self._http.request("DELETE", f"/webhooks/{webhook_id}")


class MockMail:
    def __init__(self, api_key: str, base_url: str = "https://api.mockmail.dev"):
        if not api_key:
            raise ValueError("MockMail: api_key is required")
        http = _HttpClient(api_key, base_url)
        self.boxes = _Boxes(http)
        self.emails = _Emails(http)
        self.webhooks = _Webhooks(http)
