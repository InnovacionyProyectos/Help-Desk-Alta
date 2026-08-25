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
