import os
from flask import Flask, render_template, request, redirect, url_for, flash
from extensions import db, migrate, login_manager # Предполагаем эту структуру
from models import User, Category, Transaction, Debt
from forms import (RegistrationForm, LoginForm, TransactionForm, DebtForm, CategoryForm)
from flask_login import login_user, current_user, logout_user, login_required
from datetime import datetime, timedelta, date, timezone # Убедитесь, что все есть
from sqlalchemy import func, or_
import json
from werkzeug.utils import secure_filename # Для безопасных имен файлов
from decorators import admin_required # Если есть
from admin import admin_bp # Если есть
import io
import base64
import qrcode


basedir = os.path.abspath(os.path.dirname(__file__))
app = Flask(__name__)

# --- Конфигурация приложения ---
app.config['SECRET_KEY'] = 'misavi' # Замените
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(basedir, 'instance', 'finance.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- Настройки для загрузки файлов (как были на Шаге 2) ---
UPLOAD_BASE_FOLDER = os.path.join(basedir, 'static', 'uploads')
app.config['UPLOAD_TRANSACTIONS_FOLDER'] = os.path.join(UPLOAD_BASE_FOLDER, 'transactions')
app.config['UPLOAD_DEBTS_FOLDER'] = os.path.join(UPLOAD_BASE_FOLDER, 'debts')
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

if not os.path.exists(app.config['UPLOAD_TRANSACTIONS_FOLDER']):
    os.makedirs(app.config['UPLOAD_TRANSACTIONS_FOLDER'])
if not os.path.exists(app.config['UPLOAD_DEBTS_FOLDER']):
    os.makedirs(app.config['UPLOAD_DEBTS_FOLDER'])

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']
# --- Конец настроек для загрузки файлов ---

# --- Инициализация расширений ---
db.init_app(app)
migrate.init_app(app, db)
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message_category = 'info'
login_manager.login_message = "Пожалуйста, войдите, чтобы получить доступ к этой странице."

# --- Регистрация блюпринтов ---
if 'admin_bp' in locals() or 'admin_bp' in globals():
    app.register_blueprint(admin_bp)

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

@app.context_processor
def inject_today_date():
    return {'today_date': date.today()}

# === Маршруты аутентификации ===
# ... (маршруты /register, /login, /logout без изменений) ...
@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(username=form.username.data)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash('Ваш аккаунт создан! Теперь вы можете войти.', 'success')
        return redirect(url_for('login'))
    return render_template('register.html', title='Регистрация', form=form)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and user.check_password(form.password.data):
            login_user(user, remember=form.remember.data)
            next_page = request.args.get('next')
            flash('Вход выполнен успешно!', 'success')
            return redirect(next_page) if next_page else redirect(url_for('index'))
        else:
            flash('Ошибка входа. Пожалуйста, проверьте имя пользователя и пароль.', 'danger')
    return render_template('login.html', title='Вход', form=form)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Вы вышли из системы.', 'info')
    return redirect(url_for('login'))
# === Главная страница ===
# ... (маршрут /index без изменений в этой части, он уже был настроен) ...
@app.route('/')
@login_required
def index():
    today = datetime.now(timezone.utc).date()
    start_of_month = today.replace(day=1)
    if today.month == 12:
        end_of_month = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        end_of_month = today.replace(month=today.month + 1, day=1) - timedelta(days=1)

    monthly_income = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id, Transaction.transaction_type == 'income',
        Transaction.date >= start_of_month, Transaction.date <= end_of_month
    ).scalar() or 0.0
    monthly_expenses = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id, Transaction.transaction_type == 'expense',
        Transaction.date >= start_of_month, Transaction.date <= end_of_month
    ).scalar() or 0.0
    balance = monthly_income - monthly_expenses

    expenses_by_category_query = db.session.query(Category.name, func.sum(Transaction.amount)).join(Transaction.category).filter(
        Transaction.user_id == current_user.id, Transaction.transaction_type == 'expense',
        Transaction.date >= start_of_month, Transaction.date <= end_of_month
    ).group_by(Category.name).all()
    expense_labels = [item[0] for item in expenses_by_category_query]
    expense_data = [float(item[1]) for item in expenses_by_category_query]

    income_by_category_query = db.session.query(Category.name, func.sum(Transaction.amount)).join(Transaction.category).filter(
        Transaction.user_id == current_user.id, Transaction.transaction_type == 'income',
        Transaction.date >= start_of_month, Transaction.date <= end_of_month
    ).group_by(Category.name).all()
    income_labels = [item[0] for item in income_by_category_query]
    income_data = [float(item[1]) for item in income_by_category_query]

    active_debts_lent_objects = Debt.query.filter_by(user_id=current_user.id, direction='lent', is_paid=False).all()
    active_debts_borrowed_objects = Debt.query.filter_by(user_id=current_user.id, direction='borrowed', is_paid=False).all()
    total_lent_unpaid = sum(d.amount for d in active_debts_lent_objects)
    total_borrowed_unpaid = sum(d.amount for d in active_debts_borrowed_objects)

    active_debts_lent_serializable = [{'party_name': d.party_name, 'amount': float(d.amount), 'due_date': d.due_date.isoformat() if d.due_date else None} for d in active_debts_lent_objects]
    active_debts_borrowed_serializable = [{'party_name': d.party_name, 'amount': float(d.amount), 'due_date': d.due_date.isoformat() if d.due_date else None} for d in active_debts_borrowed_objects]

    widgets_layout = [
        {"id": "stats_summary", "x": 0, "y": 0, "w": 12, "h": 2, "content_type": "summary"},
        {"id": "expenses_chart_widget", "x": 0, "y": 2, "w": 6, "h": 5, "content_type": "expenses_chart"},
        {"id": "income_chart_widget", "x": 6, "y": 2, "w": 6, "h": 5, "content_type": "income_chart"},
        {"id": "lent_debts_widget", "x": 0, "y": 7, "w": 6, "h": 4, "content_type": "lent_debts"},
        {"id": "borrowed_debts_widget", "x": 6, "y": 7, "w": 6, "h": 4, "content_type": "borrowed_debts"},
    ]
    return render_template('index.html',
                           monthly_income=monthly_income, monthly_expenses=monthly_expenses, balance=balance,
                           expense_labels_json=json.dumps(expense_labels), expense_data_json=json.dumps(expense_data),
                           income_labels_json=json.dumps(income_labels), income_data_json=json.dumps(income_data),
                           active_debts_lent_json=json.dumps(active_debts_lent_serializable),
                           active_debts_borrowed_json=json.dumps(active_debts_borrowed_serializable),
                           total_lent_unpaid=total_lent_unpaid, total_borrowed_unpaid=total_borrowed_unpaid,
                           current_month=start_of_month.strftime("%B %Y"), widgets_layout_json=json.dumps(widgets_layout))

# === Маршруты для доходов, расходов, долгов ===

@app.route('/income', methods=['GET', 'POST'])
@login_required
def income():
    form = TransactionForm(transaction_type='income', user_id=current_user.id)
    if form.validate_on_submit():
        category = db.session.get(Category, form.category.data)
        if not category or category.user_id != current_user.id or category.type != 'income':
            flash('Выбранная категория не найдена, не принадлежит вам или не является категорией дохода.', 'danger')
            return redirect(url_for('income'))

        image_filename_to_save = None
        if form.image.data: # Файл был отправлен и прошел базовую валидацию формы (Optional)
            file = form.image.data
            # FileAllowed и FileSize уже должны были сработать на уровне формы
            # Но можно добавить дополнительную проверку allowed_file, если очень нужно
            if allowed_file(file.filename): # Проверяем расширение
                filename_base = secure_filename(file.filename)
                # Генерируем уникальное имя файла
                unique_prefix = f"{current_user.id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
                # Извлекаем расширение из оригинального имени файла
                original_ext = filename_base.rsplit('.', 1)[1].lower() if '.' in filename_base else ''
                if original_ext: # Убедимся, что расширение есть
                    unique_filename = f"{unique_prefix}.{original_ext}"
                    file_path = os.path.join(app.config['UPLOAD_TRANSACTIONS_FOLDER'], unique_filename)
                    try:
                        file.save(file_path)
                        image_filename_to_save = unique_filename
                        print(f"DEBUG: Saved image {image_filename_to_save} to {file_path}") # Отладка
                    except Exception as e:
                        app.logger.error(f"Failed to save uploaded file {unique_filename}: {e}")
                        flash('Ошибка при сохранении изображения.', 'danger')
                        # Здесь можно решить, прерывать ли или сохранять без изображения
                else:
                    flash('Не удалось определить расширение файла изображения.', 'warning')
            else:
                # Это сообщение не должно появиться, если FileAllowed в форме работает
                flash('Недопустимый тип файла для изображения (проверка в маршруте).', 'warning')


        new_income = Transaction(
            amount=form.amount.data,
            date=form.date.data,
            description=form.description.data,
            category_id=form.category.data,
            transaction_type='income',
            user_id=current_user.id,
            image_filename=image_filename_to_save # Сохраняем имя файла или None
        )
        db.session.add(new_income)
        db.session.commit()
        flash('Доход успешно добавлен!', 'success')
        return redirect(url_for('income'))

    # GET запрос (пагинация)
    page = request.args.get('page', 1, type=int)
    per_page = app.config.get('ITEMS_PER_PAGE', 10) # Используем get с дефолтом
    income_query = Transaction.query.filter_by(transaction_type='income', user_id=current_user.id).order_by(Transaction.date.desc(), Transaction.id.desc())
    pagination = income_query.paginate(page=page, per_page=per_page, error_out=False)
    transactions = pagination.items
    return render_template('income.html', title='Доходы', form=form, transactions=transactions, pagination=pagination)


@app.route('/expenses', methods=['GET', 'POST'])
@login_required
def expenses():
    form = TransactionForm(transaction_type='expense', user_id=current_user.id)
    if form.validate_on_submit():
        category = db.session.get(Category, form.category.data)
        if not category or category.user_id != current_user.id or category.type != 'expense':
            flash('Выбранная категория не найдена, не принадлежит вам или не является категорией расхода.', 'danger')
            return redirect(url_for('expenses'))

        image_filename_to_save = None
        if form.image.data:
            file = form.image.data
            if allowed_file(file.filename):
                filename_base = secure_filename(file.filename)
                unique_prefix = f"{current_user.id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
                original_ext = filename_base.rsplit('.', 1)[1].lower() if '.' in filename_base else ''
                if original_ext:
                    unique_filename = f"{unique_prefix}.{original_ext}"
                    file_path = os.path.join(app.config['UPLOAD_TRANSACTIONS_FOLDER'], unique_filename)
                    try:
                        file.save(file_path)
                        image_filename_to_save = unique_filename
                    except Exception as e:
                        app.logger.error(f"Failed to save uploaded file {unique_filename}: {e}")
                        flash('Ошибка при сохранении изображения.', 'danger')
                else:
                    flash('Не удалось определить расширение файла изображения.', 'warning')
            # else: (обработано FileAllowed в форме)

        new_expense = Transaction(
            amount=form.amount.data,
            date=form.date.data,
            description=form.description.data,
            category_id=form.category.data,
            transaction_type='expense',
            user_id=current_user.id,
            image_filename=image_filename_to_save
        )
        db.session.add(new_expense)
        db.session.commit()
        flash('Расход успешно добавлен!', 'success')
        return redirect(url_for('expenses'))

    page = request.args.get('page', 1, type=int)
    per_page = app.config.get('ITEMS_PER_PAGE', 10)
    expenses_query = Transaction.query.filter_by(transaction_type='expense', user_id=current_user.id).order_by(Transaction.date.desc(), Transaction.id.desc())
    pagination = expenses_query.paginate(page=page, per_page=per_page, error_out=False)
    transactions = pagination.items
    return render_template('expenses.html', title='Расходы', form=form, transactions=transactions, pagination=pagination)


@app.route('/debts', methods=['GET', 'POST'])
@login_required
def debts():
    form = DebtForm(user_id=current_user.id) # Передаем user_id для категорий в форме
    if form.validate_on_submit():
        category = None
        if form.category.data and form.category.data != 0: # 0 это "--- Без категории ---"
            category_obj = db.session.get(Category, form.category.data) # Используем другое имя, чтобы не конфликтовать
            if not category_obj or category_obj.user_id != current_user.id or category_obj.type != 'debt':
                flash('Выбранная категория долга не найдена, не принадлежит вам или не является категорией долга.', 'danger')
                return redirect(url_for('debts'))
            category = category_obj # Присваиваем, если все проверки пройдены

        image_filename_to_save = None
        if form.image.data:
            file = form.image.data
            if allowed_file(file.filename):
                filename_base = secure_filename(file.filename)
                unique_prefix = f"{current_user.id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
                original_ext = filename_base.rsplit('.', 1)[1].lower() if '.' in filename_base else ''
                if original_ext:
                    unique_filename = f"{unique_prefix}.{original_ext}"
                    file_path = os.path.join(app.config['UPLOAD_DEBTS_FOLDER'], unique_filename) # <--- UPLOAD_DEBTS_FOLDER
                    try:
                        file.save(file_path)
                        image_filename_to_save = unique_filename
                    except Exception as e:
                        app.logger.error(f"Failed to save uploaded file {unique_filename}: {e}")
                        flash('Ошибка при сохранении изображения.', 'danger')
                else:
                    flash('Не удалось определить расширение файла изображения.', 'warning')
            # else: (обработано FileAllowed в форме)

        new_debt = Debt(
            party_name=form.party_name.data,
            amount=form.amount.data,
            due_date=form.due_date.data,
            notes=form.notes.data,
            direction=form.direction.data,
            category_id=category.id if category else None,
            user_id=current_user.id,
            image_filename=image_filename_to_save,
            date_created=date.today() # Убедимся, что date_created устанавливается
        )
        db.session.add(new_debt)
        db.session.commit()
        flash('Долг успешно добавлен!', 'success')
        return redirect(url_for('debts'))

    # GET запрос (пагинация для долгов, если нужна, или просто список)
    # Для примера оставим просто список всех долгов без пагинации
    all_debts = Debt.query.filter_by(user_id=current_user.id).order_by(Debt.is_paid, Debt.due_date.desc(), Debt.date_created.desc()).all()
    return render_template('debts.html', title='Долги', form=form, debts=all_debts)


# === Маршрут для деталей транзакции (добавляем, если еще не было) ===
@app.route('/transaction/<int:transaction_id>')
def transaction_detail(transaction_id):
    transaction = db.session.get(Transaction, transaction_id)
    qr_code_data_url = None
    try:
        page_url = url_for('transaction_detail', transaction_id=transaction.id, _external=True)
        qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=6, border=4)
        qr.add_data(page_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        qr_code_data_url = f"data:image/png;base64,{img_str}"
    except Exception as e:
        app.logger.error(f"Error generating QR code for transaction {transaction_id}: {e}")

    return render_template('transaction_detail.html',
                           title='Детали транзакции',
                           transaction=transaction,
                           qr_code_data_url=qr_code_data_url)


# === Маршруты удаления с обработкой файлов ===
@app.route('/delete_transaction/<int:transaction_id>', methods=['POST'])
@login_required
def delete_transaction(transaction_id):
    transaction = db.session.get(Transaction, transaction_id)
    if not transaction or transaction.user_id != current_user.id:
        flash('Транзакция не найдена или у вас нет к ней доступа.', 'danger')
        # Определяем, куда перенаправить после неудачного удаления
        # Можно попробовать определить тип из запроса или просто на главную
        referer_url = request.referrer
        if referer_url and ('/income' in referer_url or '/expenses' in referer_url):
            return redirect(referer_url)
        return redirect(url_for('index'))

    # --- Удаление связанного файла изображения ---
    if transaction.image_filename:
        try:
            file_path = os.path.join(app.config['UPLOAD_TRANSACTIONS_FOLDER'], transaction.image_filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"DEBUG: Deleted image file {transaction.image_filename}") # Отладка
            else:
                app.logger.warning(f"Image file not found for deletion: {file_path}")
        except OSError as e:
            app.logger.error(f"Error deleting image file {transaction.image_filename}: {e}")
    # --- Конец удаления файла ---

    transaction_type_redirect = transaction.transaction_type # 'income' или 'expense'
    db.session.delete(transaction)
    db.session.commit()
    flash('Транзакция удалена.', 'success')
    return redirect(url_for(transaction_type_redirect)) # Перенаправляем на список доходов или расходов


@app.route('/delete_debt/<int:debt_id>', methods=['POST'])
@login_required
def delete_debt(debt_id):
    debt = db.session.get(Debt, debt_id)
    if not debt or debt.user_id != current_user.id:
        flash('Долг не найден или у вас нет к нему доступа.', 'danger')
        return redirect(url_for('debts'))

    # --- Удаление связанного файла изображения ---
    if debt.image_filename:
        try:
            file_path = os.path.join(app.config['UPLOAD_DEBTS_FOLDER'], debt.image_filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"DEBUG: Deleted debt image file {debt.image_filename}") # Отладка
            else:
                app.logger.warning(f"Debt image file not found for deletion: {file_path}")
        except OSError as e:
            app.logger.error(f"Error deleting debt image file {debt.image_filename}: {e}")
    # --- Конец удаления файла ---

    db.session.delete(debt)
    db.session.commit()
    flash('Долг удален.', 'success')
    return redirect(url_for('debts'))

# ... (остальные маршруты: категории, админка и т.д.) ...
@app.route('/categories', methods=['GET', 'POST'])
@login_required
def manage_categories():
    form = CategoryForm()
    if form.validate_on_submit():
        existing_category = Category.query.filter_by(name=form.name.data, type=form.type.data, user_id=current_user.id).first()
        if existing_category:
            flash(f'Категория "{form.name.data}" типа "{form.type.data}" уже существует.', 'warning')
        else:
            new_category = Category(name=form.name.data, type=form.type.data, user_id=current_user.id)
            db.session.add(new_category)
            db.session.commit()
            flash(f'Категория "{new_category.name}" ({new_category.type}) добавлена.', 'success')
        return redirect(url_for('manage_categories'))
    categories = Category.query.filter_by(user_id=current_user.id).order_by(Category.type, Category.name).all()
    return render_template('add_category.html', title='Управление категориями', form=form, categories=categories)

@app.route('/delete_category/<int:category_id>', methods=['POST'])
@login_required
def delete_category(category_id):
    category = db.session.get(Category, category_id)
    if not category or category.user_id != current_user.id:
        flash('Категория не найдена или у вас нет к ней доступа.', 'danger')
        return redirect(url_for('manage_categories'))
    if category.transactions or category.debts: # Проверяем связи
        flash(f'Категория "{category.name}" не может быть удалена, так как она используется.', 'danger')
    else:
        db.session.delete(category)
        db.session.commit()
        flash(f'Категория "{category.name}" удалена.', 'success')
    return redirect(url_for('manage_categories'))

@app.route('/debt/toggle_paid/<int:debt_id>', methods=['POST'])
@login_required
def toggle_debt_paid(debt_id):
    debt = db.session.get(Debt, debt_id)
    if not debt or debt.user_id != current_user.id:
        flash('Долг не найден.', 'danger')
        return redirect(url_for('debts'))
    debt.is_paid = not debt.is_paid
    db.session.commit()
    flash(f'Статус долга для {debt.party_name} обновлен.', 'success')
    return redirect(url_for('debts'))


# --- Запуск приложения ---
if __name__ == '__main__':
    app.run(debug=True)