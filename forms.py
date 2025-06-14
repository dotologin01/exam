# forms.py

from flask_wtf import FlaskForm
# Убедитесь, что FileField и валидаторы импортированы
from flask_wtf.file import FileField, FileAllowed, FileSize
from wtforms import StringField, FloatField, DateField, SelectField, SubmitField, TextAreaField, BooleanField, PasswordField
from wtforms.validators import DataRequired, Length, Optional, Email, EqualTo, ValidationError
from models import User, Category # Предполагаем, что Category импортируется для списков
from datetime import date # Для default=date.today

# Определяем разрешенные расширения здесь или получаем из app.config позже
# Если определять здесь, то они не будут зависеть от app.config во время инициализации форм
ALLOWED_IMG_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']
MAX_FILE_SIZE_MB = 16 # в мегабайтах
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


class RegistrationForm(FlaskForm):
    username = StringField('Имя пользователя', validators=[DataRequired(), Length(min=4, max=25)])
    password = PasswordField('Пароль', validators=[DataRequired(), Length(min=6)])
    confirm_password = PasswordField('Подтвердите пароль', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Зарегистрироваться')

    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user:
            raise ValidationError('Это имя пользователя уже занято. Пожалуйста, выберите другое.')


class LoginForm(FlaskForm):
    username = StringField('Имя пользователя', validators=[DataRequired()])
    password = PasswordField('Пароль', validators=[DataRequired()])
    remember = BooleanField('Запомнить меня')
    submit = SubmitField('Войти')


class CategoryForm(FlaskForm):
    name = StringField('Название категории', validators=[DataRequired(), Length(min=2, max=100)])
    type = SelectField('Тип категории', choices=[
        ('income', 'Доход'),
        ('expense', 'Расход'),
        ('debt', 'Долг')
    ], validators=[DataRequired()])
    submit = SubmitField('Добавить категорию')


class TransactionForm(FlaskForm):
    amount = FloatField('Сумма', validators=[DataRequired()])
    date = DateField('Дата', format='%Y-%m-%d', validators=[DataRequired()], default=date.today)
    description = StringField('Описание', validators=[Optional(), Length(max=200)])
    category = SelectField('Категория', coerce=int, validators=[DataRequired()])
    image = FileField('Изображение (опционально)', validators=[
        Optional(), # Делает поле необязательным
        FileAllowed(ALLOWED_IMG_EXTENSIONS, 'Разрешены только изображения (png, jpg, jpeg, gif, webp)!'),
        FileSize(max_size=MAX_FILE_SIZE_BYTES, message=f'Файл слишком большой (макс {MAX_FILE_SIZE_MB}MB)')
    ])
    submit = SubmitField('Добавить')

    def __init__(self, transaction_type, user_id, *args, **kwargs):
        super(TransactionForm, self).__init__(*args, **kwargs)
        # Динамически заполняем категории в зависимости от типа транзакции и пользователя
        self.category.choices = [(c.id, c.name) for c in Category.query.filter_by(type=transaction_type, user_id=user_id).order_by(Category.name).all()]
        if not self.category.choices:
            # Добавляем "заглушку", если нет категорий, чтобы форма не ломалась
            self.category.choices = [(0, "--- Сначала добавьте категории этого типа ---")]
            # Можно даже сделать поле категории disabled или выдать предупреждение


class DebtForm(FlaskForm):
    party_name = StringField('Кому / От кого', validators=[DataRequired(), Length(max=100)])
    amount = FloatField('Сумма', validators=[DataRequired()])
    due_date = DateField('Срок возврата (опционально)', format='%Y-%m-%d', validators=[Optional()])
    notes = TextAreaField('Заметки', validators=[Optional(), Length(max=200)])
    direction = SelectField('Направление', choices=[
        ('lent', 'Я одолжил(а)'),
        ('borrowed', 'Я занял(а)')
    ], validators=[DataRequired()])
    category = SelectField('Категория долга (опционально)', coerce=int, validators=[Optional()])
    image = FileField('Изображение к долгу (опционально)', validators=[
        Optional(),
        FileAllowed(ALLOWED_IMG_EXTENSIONS, 'Разрешены только изображения (png, jpg, jpeg, gif, webp)!'),
        FileSize(max_size=MAX_FILE_SIZE_BYTES, message=f'Файл слишком большой (макс {MAX_FILE_SIZE_MB}MB)')
    ])
    submit = SubmitField('Добавить долг')

    def __init__(self, user_id, *args, **kwargs):
        super(DebtForm, self).__init__(*args, **kwargs)
        # Динамически заполняем категории долгов для пользователя
        self.category.choices = [(0, "--- Без категории ---")] + \
                                [(c.id, c.name) for c in Category.query.filter_by(type='debt', user_id=user_id).order_by(Category.name).all()]