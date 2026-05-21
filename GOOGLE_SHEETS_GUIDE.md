# Настройка Google Sheets для Бортового Журнала

Чтобы ваш бортовой журнал в приложении работал и сохранял данные в Google Таблицу, выполните следующие шаги:

## 1. Подготовка таблицы
1. Создайте новую **Google Таблицу**.
2. В первой строке создайте заголовки:
   - Столбец A: `date`
   - Столбец B: `mileage`
   - Столбец C: `service`
   - Столбец D: `cost`

## 2. Добавление скрипта
1. В таблице выберите: **Расширения** -> **Apps Script**.
2. Удалите стандартный код и вставьте следующий:

```javascript
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var data = JSON.parse(e.postData.contents);
  
  sheet.appendRow([data.date, data.mileage, data.service, data.cost]);
  
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  if (e.parameter.action === 'get') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    var result = [];
    
    // Пропускаем заголовок
    for (var i = 1; i < data.length; i++) {
      result.push({
        date: data[i][0],
        mileage: data[i][1],
        service: data[i][2],
        cost: data[i][3]
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 3. Развертывание
1. Нажмите кнопку **Начать развертывание** (Deploy) -> **Новое развертывание**.
2. Тип: **Веб-приложение**.
3. Описание: `Volvo Log API`.
4. Запуск от имени: **Вас**.
5. Кто имеет доступ: **Все** (Anyone). *Это важно для работы из PWA.*
6. Нажмите **Развернуть**. Скопируйте полученный **URL веб-приложения**.

## 4. Подключение к приложению
1. Откройте файл `books/volvo/records/log.html` в вашем проекте.
2. Найдите строку `const SCRIPT_URL = '';` (примерно 85 строка).
3. Вставьте ваш URL в кавычки.
4. Сохраните файл.

Теперь при заполнении формы в приложении данные будут улетать в вашу таблицу!
