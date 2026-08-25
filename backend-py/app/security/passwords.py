from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

# El hash PHC estandar ($argon2id$v=19$m=...$salt$hash) de argon2-cffi es
# compatible con el que genera el paquete `argon2` de Node — los usuarios
# ya existentes no necesitan resetear su contrasena al migrar.
_hasher = PasswordHasher()


def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


def verify_password(hashed: str, plain: str) -> bool:
    try:
        return _hasher.verify(hashed, plain)
    except (VerifyMismatchError, InvalidHashError):
        return False
