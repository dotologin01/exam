// Класс для управления корзиной товаров.
class Cart {
    constructor() {
        // Инициализируем массив для хранения товаров корзины.
        this.items = [];
        // Получаем ссылку на форму заказа.
        this.form = document.getElementById('order-form');
        // Получаем ссылку на контейнер для отображения товаров корзины.
        this.cartItemsContainer = document.getElementById('cart-items');
        // Получаем ссылку на элемент сообщения о пустой корзине.
        this.cartEmptyMessage = document.getElementById('cart-empty');
        // Получаем ссылку на элемент для отображения промежуточной суммы.
        this.subtotalElement = document.getElementById('subtotal');
        // Получаем ссылку на элемент для отображения общей суммы.
        this.totalElement = document.getElementById('total');
        // Получаем ссылку на элемент для отображения стоимости доставки.
        this.deliveryCostElement = document.getElementById('delivery-cost');

        // Инициализируем корзину.
        this.init();
    }

    // Асинхронный метод инициализации корзины.
    async init() {
        // Загружаем товары корзины.
        await this.loadCartItems();
        // Устанавливаем прослушиватели событий.
        this.setupEventListeners();
        // Обновляем итоговые суммы.
        this.updateTotals();
    }

    // Метод для установки прослушивателей событий.
    setupEventListeners() {
        // Проверяем, существует ли форма заказа.
        if (this.form) {
            // Добавляем обработчик события отправки формы.
            this.form.addEventListener('submit', (e) => this.handleSubmitOrder(e));
            // Добавляем обработчик события изменения даты доставки.
            this.form.elements.delivery_date.addEventListener('change', () => this.updateTotals());
            // Добавляем обработчик события изменения времени доставки.
            this.form.elements.delivery_time.addEventListener('change', () => this.updateTotals());
        }
    }

    // Асинхронный метод для загрузки товаров корзины.
    async loadCartItems() {
        // Извлекаем идентификаторы товаров из localStorage.
        const cartIds = JSON.parse(localStorage.getItem('cart') || '[]');

        // Если корзина пуста, показываем сообщение о пустой корзине и выходим.
        if (cartIds.length === 0) {
            this.showEmptyCart();
            return;
        }

        try {
            // Создаем массив промисов для получения информации о каждом товаре.
            const itemPromises = cartIds.map(id => api.get(`/goods/${id}`));
            // Получаем все товары и сохраняем в `this.items`.
            this.items = await Promise.all(itemPromises);
            // Отображаем товары корзины.
            this.renderCart();
        } catch (error) {
            // В случае ошибки, выводим сообщение в консоль и показываем сообщение о пустой корзине.
            console.error('Ошибка при загрузке товаров корзины:', error);
            this.showEmptyCart();
        }
    }

    // Метод для отображения сообщения о пустой корзине.
    showEmptyCart() {
        // Скрываем контейнер с товарами корзины.
        if (this.cartItemsContainer) {
            this.cartItemsContainer.style.display = 'none';
        }
        // Показываем сообщение о пустой корзине.
        if (this.cartEmptyMessage) {
            this.cartEmptyMessage.style.display = 'block';
        }
        // Скрываем форму заказа
         if(this.form){
           this.form.style.display = 'none';
        }
    }

    // Метод для отображения товаров корзины.
    renderCart() {
        if (this.cartItemsContainer) {
            // Используем `map` и `join` для создания HTML-разметки всех товаров и добавляем в контейнер.
            this.cartItemsContainer.innerHTML = this.items.map(item => this.createCartItemHTML(item)).join('');
        }
    }

    // Метод для создания HTML-разметки товара корзины.
    createCartItemHTML(item) {
        // Определяем цену товара (с учетом скидки, если есть).
        const price = item.discount_price || item.actual_price;
        // Создаем HTML для отображения старой цены, если есть скидка.
        const oldPrice = item.discount_price ?
            `<span class="cart-item__old-price">${item.actual_price} ₽</span>` : '';
        // Создаем HTML для бейджа скидки, если есть.
        const discountBadge = item.discount_price ?
            `<span class="cart-item__discount-badge">Скидка</span>` : '';
        
        // Возвращаем HTML-разметку товара корзины.
        return `
            <div class="cart-item" data-id="${item.id}">
                <img src="${item.image_url}" alt="${item.name}">
                    ${discountBadge}
                <div class="cart-item__info">
                    <h3>${item.name}</h3>
                    <div class="cart-item__rating">
                        ${'★'.repeat(Math.round(item.rating))}${'☆'.repeat(5 - Math.round(item.rating))}
                        <span>${item.rating}</span>
                    </div>
                    <div class="cart-item__price">
                        <span class="cart-item__current-price">${price} ₽</span>
                        ${oldPrice}
                    </div>
                </div>
                <button class="button button--danger" onclick="cart.removeItem(${item.id})">
                    Удалить
                </button>
            </div>
        `;
    }

    // Метод для удаления товара из корзины.
    removeItem(itemId) {
        // Извлекаем идентификаторы товаров из localStorage.
        const cartIds = JSON.parse(localStorage.getItem('cart') || '[]');
        // Создаем новый массив идентификаторов, исключая удаляемый товар.
        const newCartIds = cartIds.filter(id => id !== itemId);
        // Сохраняем обновленный массив в localStorage.
        localStorage.setItem('cart', JSON.stringify(newCartIds));

        // Обновляем массив товаров корзины, исключая удаленный товар.
        this.items = this.items.filter(item => item.id !== itemId);

        // Если корзина пуста, показываем сообщение о пустой корзине, иначе отображаем товары.
        if (this.items.length === 0) {
            this.showEmptyCart();
        } else {
            this.renderCart();
        }

        // Обновляем итоговые суммы и счетчик корзины.
        this.updateTotals();
        updateCartCounter();
        // Показываем уведомление об удалении товара.
        this.showNotification('Товар удален из корзины');
    }

    // Метод для расчета стоимости доставки.
    calculateDeliveryCost(date, timeInterval) {
        // Базовая стоимость доставки.
        let deliveryCost = 200;

         // Если дата или интервал доставки не выбраны, возвращаем базовую стоимость.
        if (!date || !timeInterval) return deliveryCost;

        // Создаем объект Date из даты доставки.
        const deliveryDate = new Date(date);
        // Получаем день недели (0 - воскресенье, 6 - суббота).
        const dayOfWeek = deliveryDate.getDay();
        // Получаем начальное время доставки.
        const [startTime] = timeInterval.split('-');
        // Получаем час из начального времени.
        const hour = parseInt(startTime.split(':')[0]);

        // Если доставка в выходные, добавляем стоимость.
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            deliveryCost += 300;
        }
        // Если доставка вечером, добавляем стоимость.
        else if (hour >= 18) {
            deliveryCost += 200;
        }
        // Возвращаем итоговую стоимость доставки.
        return deliveryCost;
    }

    // Метод для обновления итоговых сумм.
    updateTotals() {
        // Рассчитываем промежуточную сумму стоимости товаров.
        const subtotal = this.items.reduce((sum, item) => {
            return sum + (item.discount_price || item.actual_price);
        }, 0);

        // Инициализируем стоимость доставки.
        let deliveryCost = 0;
        // Если форма есть, расчитываем стоимость доставки
        if(this.form){
            const deliveryDate = this.form.elements.delivery_date.value;
            const deliveryTime = this.form.elements.delivery_time.value;
            deliveryCost = this.calculateDeliveryCost(deliveryDate, deliveryTime);
        }
        
        // Рассчитываем общую сумму заказа.
        const total = subtotal + deliveryCost;

        // Обновляем отображение промежуточной суммы.
        if (this.subtotalElement) {
          this.subtotalElement.textContent = `${subtotal} ₽`;
        }
         // Обновляем отображение стоимости доставки.
        if (this.deliveryCostElement) {
            this.deliveryCostElement.textContent = `${deliveryCost} ₽`;
        }

         // Обновляем отображение общей суммы заказа.
         if (this.totalElement) {
            this.totalElement.textContent = `${total} ₽`;
        }
    }

    // Асинхронный метод для обработки отправки формы заказа.
    async handleSubmitOrder(e) {
        // Предотвращаем стандартное поведение браузера.
        e.preventDefault();
        // Проверяем, есть ли форма на странице
        if(!this.form){
            return;
        }
        // Создаем объект FormData из данных формы.
        const formData = new FormData(this.form);

        // Получаем дату из формы.
        const rawDate = formData.get('delivery_date');
         // Разбираем дату на день, месяц и год.
        const [year, month, day] = rawDate.split('-');
         // Форматируем дату в нужный формат.
        const formattedDate = `${day}.${month}.${year}`;

         // Собираем данные заказа в объект.
        const orderData = {
            full_name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            delivery_address: formData.get('address'),
            delivery_date: formattedDate,
            delivery_interval: formData.get('delivery_time'),
            comment: formData.get('comment'),
            subscribe: formData.get('newsletter') ? 1 : 0,
            good_ids: this.items.map(item => item.id)
        };

        try {
            // Отправляем данные заказа на сервер.
            console.log('Отправляемые данные:', orderData);
            const response = await api.post('/orders', orderData);
             console.log('Ответ сервера:', response);
            // Очищаем корзину из localStorage.
            localStorage.removeItem('cart');
            // Показываем уведомление об успешном оформлении заказа.
            this.showNotification('Заказ успешно оформлен!', 'success');
            // Перенаправляем пользователя на главную страницу через 2 секунды.
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } catch (error) {
            // Обрабатываем ошибки при отправке заказа.
            console.error('Подробности ошибки:', error);
            // Показываем уведомление об ошибке.
            this.showNotification(`Ошибка при оформлении заказа: ${error.message}`, 'error');
        }
    }

    // Метод для отображения уведомлений.
    showNotification(message, type = 'info') {
         // Создаем элемент для уведомления.
        const notification = document.createElement('div');
         // Устанавливаем класс для стилизации.
        notification.className = `notification notification--${type}`;
         // Устанавливаем текст уведомления.
        notification.textContent = message;
         // Добавляем уведомление в DOM.
        document.getElementById('notifications').appendChild(notification);

         // Удаляем уведомление через 5 секунд.
        setTimeout(() => notification.remove(), 5000);
    }
}

// Создаем экземпляр класса Cart.
const cart = new Cart();