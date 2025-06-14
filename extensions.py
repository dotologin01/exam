# extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
# from flask_bcrypt import Bcrypt # Если вы вернули bcrypt

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()