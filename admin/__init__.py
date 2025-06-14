# admin/__init__.py
from flask import Blueprint

admin_bp = Blueprint(
    'admin',  # Имя блюпринта (для url_for и т.д.)
    __name__, # Имя текущего модуля/пакета
    template_folder='templates', # Папка для шаблонов этого блюпринта (admin/templates/)
    url_prefix='/admin' # Все маршруты этого блюпринта будут начинаться с /admin
)

from . import routes