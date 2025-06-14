# admin/routes.py
from flask import render_template, redirect, url_for, flash, request
from flask_login import login_required
from . import admin_bp # Импорт блюпринта из текущего пакета (admin)
from app import db, User # Импорт из основного приложения (app.py)
from decorators import admin_required # Если decorators.py в корне проекта
from functools import wraps
from flask import abort
from flask_login import current_user # current_user будет доступен

def temp_admin_required(f): # Временное имя, чтобы не конфликтовать, если он уже есть в app.py
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not hasattr(current_user, 'is_admin') or not current_user.is_admin():
            abort(403)
        return f(*args, **kwargs)
    return decorated_function


@admin_bp.route('/')
@login_required
@temp_admin_required # Используем наш декоратор
def dashboard():
    return render_template('admin_dashboard.html', title="Админ-панель")

@admin_bp.route('/users')
@login_required
@temp_admin_required
def list_users():
    page = request.args.get('page', 1, type=int)
    users = User.query.order_by(User.username).paginate(page=page, per_page=10)
    return render_template('admin_users.html', title="Пользователи", users=users)

# Другие маршруты: редактирование пользователя, удаление, изменение роли
# Например, для изменения роли:
@admin_bp.route('/user/<int:user_id>/toggle_admin', methods=['POST'])
@login_required
@temp_admin_required
def toggle_admin_status(user_id):
    user_to_change = db.session.get(User, user_id)
    if not user_to_change:
        flash('Пользователь не найден.', 'danger')
        return redirect(url_for('admin.list_users'))

    if user_to_change.id == current_user.id:
        flash('Вы не можете изменить свою собственную роль администратора.', 'warning')
        return redirect(url_for('admin.list_users'))

    if user_to_change.role == 'admin':
        user_to_change.role = 'user'
        flash(f'Пользователь {user_to_change.username} больше не администратор.', 'success')
    else:
        user_to_change.role = 'admin'
        flash(f'Пользователь {user_to_change.username} теперь администратор.', 'success')
    db.session.commit()
    return redirect(url_for('admin.list_users'))

@admin_bp.route('/user/<int:user_id>/delete', methods=['POST'])
@login_required
@temp_admin_required
def delete_user_admin(user_id):
    user_to_delete = db.session.get(User, user_id)
    if not user_to_delete:
        flash('Пользователь не найден.', 'danger')
        return redirect(url_for('admin.list_users'))
    if user_to_delete.id == current_user.id:
        flash('Вы не можете удалить свой собственный аккаунт через админ-панель.', 'danger')
        return redirect(url_for('admin.list_users'))

    # Дополнительно: нужно обработать связанные данные (транзакции, долги, категории)
    # Либо каскадное удаление в БД, либо удалять их здесь программно.
    # Это сложный момент! Для простоты пока просто удаляем пользователя.
    # В реальном приложении нужно решить, что делать с его данными.
    # Например, можно сделать их анонимными или удалить.
    # Или запретить удаление, если есть связанные важные данные.

    # Пример простой очистки (осторожно! удаляет все данные пользователя)
    # Transaction.query.filter_by(user_id=user_to_delete.id).delete()
    # Debt.query.filter_by(user_id=user_to_delete.id).delete()
    # Category.query.filter_by(user_id=user_to_delete.id).delete()
    # db.session.commit() # Коммит после удаления связанных данных

    db.session.delete(user_to_delete)
    db.session.commit()
    flash(f'Пользователь {user_to_delete.username} удален.', 'success')
    return redirect(url_for('admin.list_users'))