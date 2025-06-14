
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date, timezone # Добавляем timezone
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')
    transactions = db.relationship('Transaction', backref='author', lazy='dynamic', cascade="all, delete-orphan")
    debts = db.relationship('Debt', backref='owner', lazy='dynamic', cascade="all, delete-orphan")
    categories = db.relationship('Category', backref='creator', lazy='dynamic', cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def is_admin(self):
        return self.role == 'admin'

    def __repr__(self):
        return f'<User {self.username}>'


class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False) # 'income', 'expense', 'debt'
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    __table_args__ = (db.UniqueConstraint('user_id', 'name', 'type', name='_user_category_type_uc'),)

    def __repr__(self):
        return f'<Category {self.name} ({self.type}) for UserID {self.user_id}>'


class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False, default=lambda: date.today()) # Используем date.today()
    description = db.Column(db.String(200), nullable=True)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    category = db.relationship('Category', backref=db.backref('transactions', lazy=True))
    transaction_type = db.Column(db.String(50), nullable=False) # 'income' or 'expense'
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    image_filename = db.Column(db.String(255), nullable=True)  # <--- ДОБАВЛЕНО ПОЛЕ

    def __repr__(self):
        return f'<Transaction {self.transaction_type} {self.amount} on {self.date} by UserID {self.user_id}>'


class Debt(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    party_name = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    due_date = db.Column(db.Date, nullable=True)
    is_paid = db.Column(db.Boolean, default=False)
    notes = db.Column(db.String(200), nullable=True)
    direction = db.Column(db.String(50), nullable=False) # 'lent' or 'borrowed'
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=True)
    category = db.relationship('Category', backref=db.backref('debts', lazy=True))
    date_created = db.Column(db.Date, nullable=False, default=lambda: date.today()) # Используем date.today()
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    image_filename = db.Column(db.String(255), nullable=True)  # <--- ДОБАВЛЕНО ПОЛЕ

    def __repr__(self):
        status = "Paid" if self.is_paid else "Unpaid"
        direction_str = "Lent to" if self.direction == 'lent' else "Borrowed from"
        return f'<Debt {direction_str} {self.party_name}: {self.amount} ({status}) by UserID {self.user_id}>'