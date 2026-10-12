"""
Secure credential storage using encryption
"""
import os
import json
from cryptography.fernet import Fernet
from typing import Optional, Dict


class CredentialManager:
    """Manages encrypted storage of IBM credentials"""
    
    def __init__(self, key_file: str = ".credentials.key", data_file: str = ".credentials.enc"):
        self.key_file = key_file
        self.data_file = data_file
        self.cipher = None
        self._load_or_create_key()
        self._log_info(f"CredentialManager initialized with key_file={key_file}, data_file={data_file}")
    
    def _log_info(self, message: str):
        """Log info message"""
        try:
            from app.services.logger_service import logger_service
            logger_service.get_logger("api").info(f"[CredentialManager] {message}")
        except Exception:
            print(f"[CredentialManager] {message}")
    
    def _log_error(self, message: str, error: Exception):
        """Log error message"""
        try:
            from app.services.logger_service import logger_service
            logger_service.log_error(f"credential_manager.{message}", error)
        except Exception:
            print(f"[CredentialManager ERROR] {message}: {error}")
    
    def _load_or_create_key(self):
        """Load existing encryption key or create new one"""
        try:
            if os.path.exists(self.key_file):
                with open(self.key_file, "rb") as f:
                    key = f.read()
                self._log_info(f"Loaded encryption key from {self.key_file} (this is not your credentials, just the encryption key)")
            else:
                key = Fernet.generate_key()
                with open(self.key_file, "wb") as f:
                    f.write(key)
                os.chmod(self.key_file, 0o600)
                self._log_info(f"Created new encryption key at {self.key_file} (this persists even when credentials are deleted)")
            
            self.cipher = Fernet(key)
        except Exception as e:
            self._log_error("_load_or_create_key", e)
            raise
    
    def _sanitize_credential(self, value: str) -> str:
        """Remove angle brackets, whitespace, and validate credential format"""
        if not value:
            return value
        
        # Strip whitespace
        value = value.strip()
        
        # Remove angle brackets if present
        if value.startswith('<') and value.endswith('>'):
            value = value[1:-1]
            self._log_info("Removed angle brackets from credential value")
        
        # Strip any remaining whitespace
        value = value.strip()
        
        return value
    
    def save_credentials(self, token: str, crn: str, user_id: str = "default") -> None:
        """Save IBM credentials encrypted"""
        try:
            # Sanitize inputs
            token = self._sanitize_credential(token)
            crn = self._sanitize_credential(crn)
            
            # Validate inputs
            if not token or len(token) < 10:
                raise ValueError(f"Invalid token: must be at least 10 characters, got {len(token)}")
            
            if not crn or not crn.startswith('crn:'):
                raise ValueError(f"Invalid CRN: must start with 'crn:', got '{crn[:20]}...'")
            
            self._log_info(f"Saving credentials for user_id='{user_id}' (token_len={len(token)}, crn_len={len(crn)})")
            
            credentials = self._load_all_credentials()
            
            credentials[user_id] = {
                "token": token,
                "crn": crn
            }
            
            encrypted_data = self.cipher.encrypt(json.dumps(credentials).encode())
            
            with open(self.data_file, "wb") as f:
                f.write(encrypted_data)
            
            os.chmod(self.data_file, 0o600)
            
            self._log_info(f"Successfully saved credentials for user_id='{user_id}' to {self.data_file}")
        except Exception as e:
            self._log_error("save_credentials", e)
            raise
    
    def load_credentials(self, user_id: str = "default") -> Optional[Dict[str, str]]:
        """Load IBM credentials decrypted"""
        try:
            credentials = self._load_all_credentials()
            creds = credentials.get(user_id)
            
            if creds:
                self._log_info(f"Loaded credentials for user_id='{user_id}' (token_len={len(creds.get('token', ''))}, crn_len={len(creds.get('crn', ''))})")
            else:
                self._log_info(f"No credentials found for user_id='{user_id}'")
            
            return creds
        except Exception as e:
            self._log_error("load_credentials", e)
            return None
    
    def _load_all_credentials(self) -> Dict[str, Dict[str, str]]:
        """Load all credentials"""
        if not os.path.exists(self.data_file):
            self._log_info(f"Credential file {self.data_file} does not exist")
            return {}
        
        try:
            with open(self.data_file, "rb") as f:
                encrypted_data = f.read()
            
            decrypted_data = self.cipher.decrypt(encrypted_data)
            credentials = json.loads(decrypted_data.decode())
            
            self._log_info(f"Loaded {len(credentials)} user credential(s) from {self.data_file}")
            return credentials
        except Exception as e:
            self._log_error("_load_all_credentials", e)
            return {}
    
    def delete_credentials(self, user_id: str = "default") -> bool:
        """Delete credentials for user"""
        try:
            credentials = self._load_all_credentials()
            
            if user_id in credentials:
                del credentials[user_id]
                self._log_info(f"Deleted credentials for user_id='{user_id}'")
                
                if credentials:
                    encrypted_data = self.cipher.encrypt(json.dumps(credentials).encode())
                    with open(self.data_file, "wb") as f:
                        f.write(encrypted_data)
                    self._log_info(f"Updated credential file with remaining {len(credentials)} user(s)")
                else:
                    if os.path.exists(self.data_file):
                        os.remove(self.data_file)
                    self._log_info(f"Removed credential file {self.data_file} (no users remaining)")
                
                return True
            else:
                self._log_info(f"No credentials found for user_id='{user_id}' to delete")
                return False
        except Exception as e:
            self._log_error("delete_credentials", e)
            return False
    
    def has_credentials(self, user_id: str = "default") -> bool:
        """Check if credentials exist for user"""
        credentials = self._load_all_credentials()
        exists = user_id in credentials
        self._log_info(f"Credentials exist for user_id='{user_id}': {exists}")
        return exists


credential_manager = CredentialManager()
