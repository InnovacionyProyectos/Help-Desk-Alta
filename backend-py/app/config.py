from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    db_host: str = "localhost"
    db_port: int = 5432
    db_username: str = "helpdesk_app"
    db_password: str = ""
    db_database: str = "helpdesk"

    session_secret: str
    session_cookie_name: str = "hd_session"
    session_expires_hours: int = 12

    app_env: str = "development"

    # Directorio raiz de adjuntos, relativo al cwd del proceso (ver run.py:
    # se ejecuta con cwd=backend-py). Mismo nombre de variable y mismo valor
    # por defecto que backend/.env (NestJS) para que, si algun dia ambos
    # procesos comparten cwd, apunten al mismo arbol de archivos sin migrar
    # nada — hoy resuelven a carpetas fisicas distintas porque corren desde
    # directorios de trabajo distintos.
    storage_local_path: str = "./uploads"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.db_username}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_database}"
        )

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


settings = Settings()
