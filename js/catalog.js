// Класс для управления каталогом товаров.
class Catalog {
    constructor() {
        // Инициализируем массив для хранения товаров каталога.
        this.products = [];
        // Инициализируем Set для хранения категорий товаров.
        this.categories = new Set();
        // Устанавливаем текущую страницу для пагинации.
        this.currentPage = 1;
        // Устанавливаем количество товаров на странице.
        this.itemsPerPage = 100;
        // Инициализируем общее количество товаров.
        this.totalProducts = 0;
        // Инициализируем общее количество страниц.
        this.totalPages = 0;
        // Инициализируем объект фильтров.
        this.filters = {
            categories: new Set(), // Set для хранения выбранных категорий.
            priceFrom: null, // Нижняя граница цены.
            priceTo: null,   // Верхняя граница цены.
            discount: false  // Фильтр по товарам со скидкой.
        };
         // Устанавливаем тип сортировки по умолчанию.
        this.sortType = 'price_asc';

        // Получаем ссылки на необходимые элементы DOM.
        this.productsGrid = document.getElementById('products-grid'); // Контейнер для товаров.
        this.filtersForm = document.getElementById('filters-form'); // Форма фильтров.
        this.sortSelect = document.getElementById('sort-select'); // Селект для выбора типа сортировки.
        this.pagination = document.getElementById('pagination'); // Контейнер для пагинации.

        // Инициализируем каталог.
        this.init();
    }

    // Асинхронный метод инициализации каталога.
    async init() {
        // Загружаем товары.
        await this.loadProducts();
        // Устанавливаем слушатели событий.
        this.setupEventListeners();
         // Отображаем категории.
        this.renderCategories();
        // Отображаем товары.
        this.renderProducts();
    }

    // Метод для установки слушателей событий.
    setupEventListeners() {
        // Добавляем обработчик события отправки формы фильтров.
        this.filtersForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Предотвращаем стандартную отправку формы.
            this.handleFilterSubmit(); // Вызываем метод для обработки фильтрации.
        });
        // Добавляем обработчик события изменения селекта сортировки.
        this.sortSelect.addEventListener('change', () => {
            this.sortType = this.sortSelect.value; // Обновляем тип сортировки.
            this.currentPage = 1; // Сбрасываем страницу на 1.
            this.renderProducts(); // Обновляем отображение товаров.
        });
    }

    // Асинхронный метод для загрузки товаров из API.
    async loadProducts(page = 1) {
        try {
            // Выполняем GET-запрос к API для получения товаров.
            const response = await api.get('/goods', {
                page: page, // Номер текущей страницы.
                per_page: this.itemsPerPage // Количество товаров на странице.
            });

            // Обновляем текущую страницу, общее количество товаров и страниц из ответа API.
            this.currentPage = response._pagination.current_page;
            this.totalProducts = response._pagination.total_count;
            this.totalPages = Math.ceil(this.totalProducts / this.itemsPerPage);

            // Сохраняем товары в массиве.
            this.products = response.goods;

            // Добавляем категории из товаров в Set.
            this.products.forEach(product => {
                this.categories.add(product.main_category);
            });

            // Обновляем пагинацию, отображаем категории и товары.
            this.updatePagination();
             this.renderCategories();
            this.renderProducts();
        } catch (error) {
            // В случае ошибки выводим сообщение в консоль.
            console.error('Ошибка при загрузке товаров:', error);
        }
    }

     // Метод для обновления пагинации.
    updatePagination() {
        // Очищаем содержимое контейнера пагинации.
        this.pagination.innerHTML = '';

        // Если количество страниц больше 1, добавляем кнопки пагинации.
        if (this.totalPages > 1) {
             // Цикл по всем страницам.
            for (let i = 1; i <= this.totalPages; i++) {
                // Создаем кнопку для страницы.
                const button = document.createElement('button');
                // Устанавливаем текст кнопки.
                button.textContent = i;
                // Устанавливаем класс для кнопки.
                button.className = 'pagination-button';
                // Если текущая страница, добавляем класс активной кнопки.
                if (i === this.currentPage) {
                    button.classList.add('active');
                }

                // Добавляем обработчик события клика на кнопку.
                button.addEventListener('click', async () => {
                     // Обновляем текущую страницу.
                    this.currentPage = i;
                    // Загружаем товары для выбранной страницы.
                    await this.loadProducts(i);
                });

                // Добавляем кнопку в контейнер пагинации.
                this.pagination.appendChild(button);
            }
        }
    }
     // Метод для отображения категорий.
    renderCategories() {
        // Получаем элемент списка категорий.
        const categoriesList = document.getElementById('categories-list');
        // Преобразуем Set категорий в HTML-разметку списка checkbox.
        categoriesList.innerHTML = Array.from(this.categories)
            .map(category => `
                <label class="checkbox-label">
                    <input type="checkbox" name="category" value="${category}">
                    ${category}
                </label>
            `).join('');
    }

    // Метод для обработки отправки формы фильтров.
    handleFilterSubmit() {
        // Получаем выбранные категории из формы.
        const selectedCategories = Array.from(this.filtersForm.querySelectorAll('input[name="category"]:checked'))
            .map(input => input.value);
        // Обновляем Set выбранных категорий.
        this.filters.categories = new Set(selectedCategories);

        // Получаем значения цены "от" и "до" из формы.
        const priceFrom = this.filtersForm.querySelector('input[name="price_from"]').value;
        const priceTo = this.filtersForm.querySelector('input[name="price_to"]').value;
        // Обновляем значения фильтров цен.
        this.filters.priceFrom = priceFrom ? Number(priceFrom) : null;
        this.filters.priceTo = priceTo ? Number(priceTo) : null;

        // Обновляем значение фильтра по скидке.
        this.filters.discount = this.filtersForm.querySelector('input[name="discount"]').checked;
        // Сбрасываем текущую страницу и загружаем товары.
        this.currentPage = 1;
        this.loadProducts();
        // Отображаем отфильтрованные товары.
        this.renderProducts();
    }
   // Метод для фильтрации товаров.
    filterProducts() {
        // Фильтруем товары в соответствии с текущими фильтрами.
        return this.products.filter(product => {
             // Если выбраны категории и текущий товар не принадлежит выбранной категории, отфильтровываем его.
            if (this.filters.categories.size > 0 && !this.filters.categories.has(product.main_category)) {
                return false;
            }

             // Получаем цену товара с учетом скидки.
            const price = product.discount_price || product.actual_price;

            // Если установлена нижняя граница цены и цена товара меньше, отфильтровываем его.
            if (this.filters.priceFrom !== null && price < this.filters.priceFrom) {
                return false;
            }
            // Если установлена верхняя граница цены и цена товара больше, отфильтровываем его.
            if (this.filters.priceTo !== null && price > this.filters.priceTo) {
                return false;
            }
             // Если фильтр по скидке включен и у товара нет скидки, отфильтровываем его.
            if (this.filters.discount && !product.discount_price) {
                return false;
            }
             // Если товар соответствует всем фильтрам, оставляем его.
            return true;
        });
    }

     // Метод для сортировки товаров.
    sortProducts(products) {
        // Создаем копию массива товаров для сортировки.
        return [...products].sort((a, b) => {
             // Получаем цену товара с учетом скидки.
            const priceA = a.discount_price || a.actual_price;
            const priceB = b.discount_price || b.actual_price;

            // Сортируем в зависимости от выбранного типа сортировки.
            switch (this.sortType) {
                // Сортировка по возрастанию цены.
                case 'price_asc':
                    return priceA - priceB;
                    // Сортировка по убыванию цены.
                case 'price_desc':
                    return priceB - priceA;
                    // Сортировка по рейтингу (сначала с большим рейтингом).
                case 'rating':
                    return b.rating - a.rating;
                    // Если тип сортировки не известен, не меняем порядок.
                default:
                    return 0;
            }
        });
    }

    // Метод для отображения отфильтрованных и отсортированных товаров.
    renderProducts(append = false) {
         // Получаем отфильтрованные товары.
        const filteredProducts = this.filterProducts();
        // Получаем отсортированные товары.
        const sortedProducts = this.sortProducts(filteredProducts);

        // Рассчитываем индексы начала и конца отображаемых товаров на странице.
        const startIndex = append ? (this.currentPage - 1) * this.itemsPerPage : 0;
        const endIndex = this.currentPage * this.itemsPerPage;
        // Выбираем товары для отображения на текущей странице.
        const productsToShow = sortedProducts.slice(startIndex, endIndex);

        // Преобразуем массив товаров в HTML разметку и добавляем в DOM.
        const productsHTML = productsToShow.map(product => this.createProductCard(product)).join('');
        
        // Если добавление, то добавляем к уже существующим, иначе заменяем все.
        if (append) {
            this.productsGrid.innerHTML += productsHTML;
        } else {
            this.productsGrid.innerHTML = productsHTML;
        }
    }

    // Метод для создания HTML разметки карточки товара.
    createProductCard(product) {
         // Получаем цену товара с учетом скидки.
        const price = product.discount_price || product.actual_price;
         // Формируем HTML для старой цены.
        const oldPrice = product.discount_price ?
            `<span class="product-card__old-price">${product.actual_price} ₽</span>` : '';
         // Формируем HTML для бейджа скидки.
        const discountBadge = product.discount_price ?
            `<span class="product-card__discount-badge">Скидка</span>` : '';

        // Возвращаем HTML разметку карточки товара.
        return `
            <div class="product-card">
                <img src="${product.image_url}" alt="${product.name}">
                    ${discountBadge}
                <h3 class="product-card__title" title="${product.name}">
                    ${product.name}
                </h3>
                <div class="product-card__rating">
                    ${'★'.repeat(Math.round(product.rating))}${'☆'.repeat(5 - Math.round(product.rating))}
                    <span>${product.rating}</span>
                </div>
                <div class="product-card__price">
                    <span class="product-card__current-price">${price} ₽</span>
                    ${oldPrice}
                </div>
                <button class="button button--primary" onclick="catalog.addToCart(${product.id})">
                    Добавить в корзину
                </button>
            </div>
        `;
    }

    // Метод для добавления товара в корзину.
    addToCart(productId) {
        // Извлекаем текущие товары в корзине из localStorage.
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        // Добавляем новый товар в корзину.
        cart.push(productId);
        // Обновляем корзину в localStorage.
        localStorage.setItem('cart', JSON.stringify(cart));
        // Показываем уведомление об успешном добавлении товара в корзину.
        this.showNotification('Товар добавлен в корзину', 'success');
         // Обновляем счетчик товаров в корзине.
        updateCartCounter();
    }

    // Метод для отображения уведомлений.
    showNotification(message, type = 'info') {
        // Создаем элемент уведомления.
        const notification = document.createElement('div');
        // Устанавливаем класс для стилизации уведомления.
        notification.className = `notification notification--${type}`;
        // Устанавливаем текст уведомления.
        notification.textContent = message;
        // Добавляем уведомление в контейнер.
        document.getElementById('notifications').appendChild(notification);

        // Удаляем уведомление через 5 секунд.
        setTimeout(() => notification.remove(), 5000);
    }
}

// Функция для обновления счетчика товаров в корзине на странице.
function updateCartCounter() {
    // Получаем данные о корзине из localStorage.
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    // Получаем элемент DOM для отображения счетчика.
    const cartCount = document.querySelector('.cart-count');
    // Проверяем, что элемент существует.
    if (cartCount) {
        // Получаем количество товаров в корзине.
        const count = cart.length;
        // Обновляем текст элемента счетчика.
        cartCount.innerHTML = `🛒 Корзина ${count > 0 ? `(${count})` : ''}`;
    }
}

// Обновляем счетчик корзины при загрузке страницы.
document.addEventListener('DOMContentLoaded', updateCartCounter);

// Создаем экземпляр класса Catalog.
const catalog = new Catalog();