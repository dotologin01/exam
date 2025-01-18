// Класс для управления заказами.
class Orders {
    constructor() {
        // Инициализируем массив для хранения заказов.
        this.orders = [];
         // Инициализируем Map для кэширования товаров (ключ - id товара, значение - объект товара).
        this.products = new Map();
        // Инициализируем id текущего редактируемого заказа.
        this.currentOrderId = null;
        // Инициализируем заказы.
        this.init();
    }

    // Асинхронный метод инициализации заказов.
    async init() {
        // Загружаем заказы.
        await this.loadOrders();
        // Устанавливаем слушатели событий.
        this.setupEventListeners();
    }

    // Метод для установки слушателей событий.
    setupEventListeners() {
        // Добавляем обработчик события клика на все кнопки закрытия модальных окон.
        document.querySelectorAll('.modal__close').forEach(button => {
             // При клике закрываем модальное окно.
            button.addEventListener('click', () => {
                this.closeModal(button.closest('.modal').id);
            });
        });
    }
     // Асинхронный метод для загрузки заказов.
    async loadOrders() {
        try {
             // Загружаем заказы из API.
            this.orders = await api.get('/orders');

            // Создаем Set для хранения уникальных id товаров из всех заказов.
            const productIds = new Set();
             // Собираем все id товаров из заказов в Set.
            this.orders.forEach(order => {
                order.good_ids.forEach(id => productIds.add(id));
            });

            // Загружаем данные о товарах (используем Promise.all для параллельной загрузки).
            await Promise.all(Array.from(productIds).map(async id => {
                 // Загружаем данные о товаре.
                const product = await api.get(`/goods/${id}`);
                 // Добавляем товар в кэш this.products.
                this.products.set(id, product);
            }));

            // Отображаем заказы.
            this.renderOrders();
        } catch (error) {
            // Обрабатываем ошибки загрузки заказов.
            console.error('Ошибка при загрузке заказов:', error);
        }
    }

    // Метод для расчета стоимости доставки.
    calculateDeliveryCost(date, timeInterval) {
        // Базовая стоимость доставки.
        let deliveryCost = 200;

        // Если дата или интервал доставки не выбраны, возвращаем базовую стоимость.
        if (!date || !timeInterval) return deliveryCost;
        // Преобразуем строку с датой в объект Date.
        const deliveryDate = new Date(date.split('.').reverse().join('-'));
        // Получаем день недели (0 - воскресенье, 6 - суббота).
        const dayOfWeek = deliveryDate.getDay();
        // Получаем начальное время из интервала доставки.
        const [startTime] = timeInterval.split('-');
        // Получаем час из начального времени.
        const hour = parseInt(startTime.split(':')[0]);

        // Увеличиваем стоимость доставки для выходных.
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            deliveryCost += 300;
        }
        // Увеличиваем стоимость доставки для вечернего времени.
        else if (hour >= 18) {
            deliveryCost += 200;
        }

        // Возвращаем итоговую стоимость доставки.
        return deliveryCost;
    }

    // Метод для расчета общей стоимости заказа.
    calculateOrderTotal(order) {
        // Рассчитываем стоимость товаров в заказе.
        const goodsTotal = order.good_ids.reduce((total, id) => {
            // Получаем товар из кэша.
            const product = this.products.get(id);
            // Если товар найден, прибавляем его стоимость к сумме.
            if (product) {
                return total + (product.discount_price || product.actual_price);
            }
            // Если товар не найден, возвращаем текущую сумму.
            return total;
        }, 0);
         // Получаем стоимость доставки.
        const deliveryCost = this.calculateDeliveryCost(order.delivery_date, order.delivery_interval);
         // Возвращаем общую стоимость заказа.
        return goodsTotal + deliveryCost;
    }

    // Метод для форматирования списка товаров заказа.
    formatOrderItems(goodIds) {
        // Получаем имена товаров из списка идентификаторов.
        return goodIds.map(id => {
            // Получаем товар из кэша.
            const product = this.products.get(id);
            // Возвращаем название товара или 'Товар не найден', если товар не существует.
            return product ? product.name : 'Товар не найден';
        }).join(', ');
    }

     // Метод для отображения списка заказов.
    renderOrders() {
        // Получаем элемент списка заказов.
        const ordersList = document.getElementById('orders-list');
        // Заполняем список HTML-разметкой.
        ordersList.innerHTML = this.orders.map((order, index) => this.createOrderRow(order, index + 1)).join('');
    }

    // Метод для создания HTML-разметки строки заказа.
    createOrderRow(order, index) {
        // Форматируем дату создания заказа.
        const date = new Date(order.created_at);
        const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        // Получаем итоговую стоимость заказа.
        const total = this.calculateOrderTotal(order);
        
        // Возвращаем HTML-разметку строки заказа.
        return `
            <tr>
                <td>${index}</td>
                <td>${formattedDate}</td>
                <td title="${this.formatOrderItems(order.good_ids)}">
                    ${this.formatOrderItems(order.good_ids).slice(0, 100)}${this.formatOrderItems(order.good_ids).length > 100 ? '...' : ''}
                </td>
                <td>${total} ₽</td>
                <td>${order.delivery_date}<br>${order.delivery_interval}</td>
                <td class="order-actions">
                    <button class="action-button" onclick="orders.viewOrder(${order.id})">👁️</button>
                    <button class="action-button" onclick="orders.editOrder(${order.id})">✏️</button>
                    <button class="action-button" onclick="orders.deleteOrder(${order.id})">🗑️</button>
                </td>
            </tr>
        `;
    }

    // Асинхронный метод для отображения подробностей заказа.
    async viewOrder(orderId) {
        // Находим заказ по его id.
        const order = this.orders.find(o => o.id === orderId);
        // Если заказ не найден, выходим из метода.
        if (!order) return;

         // Получаем общую стоимость товаров в заказе.
         const goodsTotal = order.good_ids.reduce((total, id) => {
            // Получаем товар из кэша.
            const product = this.products.get(id);
            // Если товар найден, прибавляем его стоимость.
            if (product) {
                return total + (product.discount_price || product.actual_price);
            }
            // Если товар не найден, возвращаем текущую сумму.
            return total;
        }, 0);
        // Получаем стоимость доставки.
        const deliveryCost = this.calculateDeliveryCost(order.delivery_date, order.delivery_interval);
         // Получаем итоговую сумму заказа.
        const total = goodsTotal + deliveryCost;
         // Получаем список товаров в заказе.
        const orderItems = this.formatOrderItems(order.good_ids);
        
        // Находим элемент для отображения деталей заказа.
        const details = document.getElementById('view-order-details');
        // Заполняем элемент HTML-разметкой с информацией о заказе.
        details.innerHTML = `
            <div class="order-info">
                <div class="order-info-item">
                    <span>Дата оформления:</span>
                    <span>${new Date(order.created_at).toLocaleString()}</span>
                </div>
                <div class="order-info-item">
                    <span>Имя:</span>
                    <span>${order.full_name}</span>
                </div>
                <div class="order-info-item">
                    <span>Email:</span>
                    <span>${order.email}</span>
                </div>
                <div class="order-info-item">
                    <span>Телефон:</span>
                    <span>${order.phone}</span>
                </div>
                <div class="order-info-item">
                    <span>Адрес доставки:</span>
                    <span>${order.delivery_address}</span>
                </div>
                <div class="order-info-item">
                    <span>Дата доставки:</span>
                    <span>${order.delivery_date}</span>
                </div>
                <div class="order-info-item">
                    <span>Время доставки:</span>
                    <span>${order.delivery_interval}</span>
                </div>
                <div class="order-info-item">
                    <span>Состав заказа:</span>
                    <span>${orderItems}</span>
                </div>
                <div class="order-info-item">
                    <span>Комментарий:</span>
                    <span>${order.comment || '-'}</span>
                </div>
                <div class="order-info-item">
                    <span>Стоимость товаров:</span>
                    <span>${goodsTotal} ₽</span>
                </div>
                <div class="order-info-item">
                    <span>Стоимость доставки:</span>
                    <span>${deliveryCost} ₽</span>
                </div>
                <div class="order-info-item">
                    <span>Итого:</span>
                    <span>${total} ₽</span>
                </div>
            </div>
        `;
        // Открываем модальное окно с деталями заказа.
        this.openModal('view-modal');
    }

   // Асинхронный метод для редактирования заказа.
    async editOrder(orderId) {
         // Находим заказ по id.
        const order = this.orders.find(o => o.id === orderId);
        // Если заказ не найден, выходим из метода.
        if (!order) return;
         // Сохраняем id текущего редактируемого заказа.
        this.currentOrderId = orderId;

        // Находим форму редактирования заказа.
        const form = document.getElementById('edit-order-form');
        // Заполняем форму данными заказа.
        form.elements.full_name.value = order.full_name;
        form.elements.email.value = order.email;
        form.elements.phone.value = order.phone;
        form.elements.delivery_address.value = order.delivery_address;
        form.elements.delivery_date.value = this.formatDateForInput(order.delivery_date);
        form.elements.delivery_interval.value = order.delivery_interval;
        form.elements.comment.value = order.comment || '';

        // Открываем модальное окно редактирования заказа.
        this.openModal('edit-modal');
    }

    // Метод для форматирования даты для input type="date".
    formatDateForInput(dateStr) {
        // Разделяем строку даты на день, месяц и год.
        const [day, month, year] = dateStr.split('.');
        // Возвращаем отформатированную строку для input type="date".
        return `${year}-${month}-${day}`;
    }

    // Асинхронный метод для сохранения отредактированного заказа.
    async saveOrder() {
        // Если id текущего редактируемого заказа не существует, выходим из метода.
        if (!this.currentOrderId) return;

         // Находим форму редактирования заказа.
        const form = document.getElementById('edit-order-form');
        // Получаем данные из формы.
        const formData = new FormData(form);
        
        // Форматирование даты
        const rawDate = formData.get('delivery_date');
        const [year, month, day] = rawDate.split('-');
        const formattedDate = `${day}.${month}.${year}`;

        // Создаем объект данных для запроса.
        const orderData = {
            full_name: formData.get('full_name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            delivery_address: formData.get('delivery_address'),
            delivery_date: formattedDate,
            delivery_interval: formData.get('delivery_interval'),
            comment: formData.get('comment')
        };

        try {
            // Отправляем PUT запрос для обновления заказа.
            await api.put(`/orders/${this.currentOrderId}`, orderData);
             // Перезагружаем заказы.
            await this.loadOrders();
            // Закрываем модальное окно редактирования.
            this.closeModal('edit-modal');
             // Выводим уведомление об успешном обновлении заказа.
            this.showNotification('Заказ успешно обновлен', 'success');
        } catch (error) {
            // Выводим уведомление об ошибке при обновлении заказа.
            this.showNotification('Ошибка при обновлении заказа', 'error');
        }
    }

    // Метод для открытия модального окна подтверждения удаления заказа.
    deleteOrder(orderId) {
        // Сохраняем id текущего удаляемого заказа.
        this.currentOrderId = orderId;
        // Открываем модальное окно подтверждения удаления.
        this.openModal('delete-modal');
    }

    // Асинхронный метод для подтверждения удаления заказа.
    async confirmDelete() {
         // Если id текущего удаляемого заказа не существует, выходим из метода.
        if (!this.currentOrderId) return;

        try {
            // Отправляем DELETE запрос для удаления заказа.
            await api.delete(`/orders/${this.currentOrderId}`);
             // Перезагружаем заказы.
            await this.loadOrders();
             // Закрываем модальное окно подтверждения удаления.
            this.closeModal('delete-modal');
            // Выводим уведомление об успешном удалении заказа.
            this.showNotification('Заказ успешно удален', 'success');
        } catch (error) {
            // Выводим уведомление об ошибке при удалении заказа.
            this.showNotification('Ошибка при удалении заказа', 'error');
        }
    }
    // Метод для открытия модального окна.
    openModal(modalId) {
        // Добавляем класс 'active' для отображения модального окна.
        document.getElementById(modalId).classList.add('active');
    }

    // Метод для закрытия модального окна.
    closeModal(modalId) {
         // Удаляем класс 'active' для скрытия модального окна.
        document.getElementById(modalId).classList.remove('active');
         // Если закрываем окно редактирования, сбрасываем id текущего редактируемого заказа.
        if (modalId === 'edit-modal') {
            this.currentOrderId = null;
        }
    }

    // Метод для отображения уведомлений.
    showNotification(message, type = 'info') {
        // Создаем элемент для уведомления.
        const notification = document.createElement('div');
        // Устанавливаем классы для стилизации.
        notification.className = `notification notification--${type}`;
        // Устанавливаем текст уведомления.
        notification.textContent = message;
         // Добавляем уведомление в DOM.
        document.getElementById('notifications').appendChild(notification);
        
        // Удаляем уведомление через 5 секунд.
        setTimeout(() => notification.remove(), 5000);
    }
}

// Создаем экземпляр класса Orders.
const orders = new Orders();