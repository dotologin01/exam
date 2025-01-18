// Функция для обновления счетчика товаров в корзине на странице.
function updateCartCounter() {
    // 1. Получаем данные о корзине из локального хранилища.
    //    - `localStorage.getItem('cart')`: Извлекает строку JSON, представляющую корзину.
    //    - `|| '[]'`: Если в хранилище нет данных о корзине, используется пустой массив.
    //    - `JSON.parse(...)`: Преобразует JSON-строку в JavaScript массив (или пустой массив, если строка пустая).
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    
    // 2. Получаем элемент DOM, в котором отображается счетчик корзины.
    const cartCount = document.querySelector('.cart-count');
    
    // 3. Проверяем, найден ли элемент счетчика на странице.
    if (cartCount) {
        // 4. Получаем количество товаров в корзине.
        const count = cart.length;
        
        // 5. Обновляем текст элемента счетчика.
        //    - `🛒 Корзина`: Статический текст.
        //    - `${count > 0 ? `(${count})` : ''}`: Если количество товаров больше 0, то добавляем в скобках это количество.
        //      В противном случае ничего не добавляем.
        cartCount.innerHTML = `🛒 Корзина ${count > 0 ? `(${count})` : ''}`;
    }
}

// Класс для взаимодействия с API.
class API {
    constructor() {
        // Базовый URL для всех API-запросов.
        this.baseUrl = 'https://edu.std-900.ist.mospolytech.ru/exam-2024-1/api';
        // API-ключ для авторизации запросов.
        this.apiKey = 'd70c5ad1-1980-475b-b33a-d68d32f1dad4';
    }

    // Метод для выполнения GET-запросов.
    async get(endpoint, params = {}) {
        // 1. Создаем объект URLSearchParams для добавления параметров запроса.
        //    - Включаем переданные параметры и API-ключ.
        const queryParams = new URLSearchParams({
            ...params,
            api_key: this.apiKey
        });
        
        try {
            // 2. Выполняем fetch запрос по указанному URL, добавляя параметры.
            const response = await fetch(`${this.baseUrl}${endpoint}?${queryParams}`);
            // 3. Проверяем статус ответа. Если он не 200-299, то выбрасываем ошибку.
            if (!response.ok) throw new Error('Ошибка запроса');
             // 4. Если все ОК, парсим ответ как JSON и возвращаем.
            return await response.json();
        } catch (error) {
            // 5. Если произошла ошибка, показываем ее пользователю и пробрасываем ошибку дальше.
            this.showError(error);
            throw error;
        }
    }
    
    // Метод для выполнения POST-запросов.
    async post(endpoint, data) {
        try {
            // 1. Выполняем fetch запрос по указанному URL, добавляя параметры.
            const response = await fetch(`${this.baseUrl}${endpoint}?api_key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            // 2. Получаем текст ответа для анализа ошибки.
            const responseText = await response.text();
            
            // 3. Проверяем статус ответа. Если он не 200-299, то выбрасываем ошибку.
            if (!response.ok) {
                // 4. Пытаемся распарсить JSON с ошибкой. Если не удается, берем текст ошибки или статус ответа.
                let errorMessage;
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.error || 'Ошибка запроса';
                } catch {
                    errorMessage = responseText || response.statusText || 'Ошибка запроса';
                }
                throw new Error(errorMessage);
            }

            // 5. Если ответ пустой, возвращаем успех.
            if (!responseText) {
                return { success: true };
            }

            // 6. Пытаемся распарсить JSON ответ. Если не удается, возвращаем успех и текст ответа.
            try {
                return JSON.parse(responseText);
            } catch {
                return { success: true, data: responseText };
            }
        } catch (error) {
            // 7. Если произошла ошибка, показываем ее пользователю и пробрасываем ошибку дальше.
            this.showError(error);
            throw error;
        }
    }
    
   // Метод для выполнения PUT-запросов.
    async put(endpoint, data) {
        try {
            // 1. Выполняем fetch запрос по указанному URL, добавляя параметры.
            const response = await fetch(`${this.baseUrl}${endpoint}?api_key=${this.apiKey}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
             // 2. Проверяем статус ответа. Если он не 200-299, то выбрасываем ошибку.
            if (!response.ok) throw new Error('Ошибка запроса');
             // 3. Если все ОК, парсим ответ как JSON и возвращаем.
            return await response.json();
        } catch (error) {
            // 4. Если произошла ошибка, показываем ее пользователю и пробрасываем ошибку дальше.
            this.showError(error);
            throw error;
        }
    }

    // Метод для выполнения DELETE-запросов.
    async delete(endpoint) {
        try {
            // 1. Выполняем fetch запрос по указанному URL, добавляя параметры.
            const response = await fetch(`${this.baseUrl}${endpoint}?api_key=${this.apiKey}`, {
                method: 'DELETE'
            });
             // 2. Проверяем статус ответа. Если он не 200-299, то выбрасываем ошибку.
            if (!response.ok) throw new Error('Ошибка запроса');
            // 3. Если все ОК, парсим ответ как JSON и возвращаем.
            return await response.json();
        } catch (error) {
            // 4. Если произошла ошибка, показываем ее пользователю и пробрасываем ошибку дальше.
            this.showError(error);
            throw error;
        }
    }
    
    // Метод для отображения ошибок.
    showError(error) {
        // 1. Получаем элемент DOM для уведомлений.
        const notifications = document.getElementById('notifications');
         // 2. Создаем элемент для нового уведомления об ошибке.
        const notification = document.createElement('div');
        // 3. Добавляем стили и текст ошибки.
        notification.className = 'notification notification--error';
        notification.textContent = error.message;
        // 4. Добавляем уведомление в контейнер.
        notifications.appendChild(notification);
        
        // 5. Устанавливаем таймер, чтобы убрать уведомление через 5 секунд.
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Создаем экземпляр класса API.
const api = new API();