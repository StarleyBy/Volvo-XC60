# Настройка Google Sheets для Дневника Volvo XC60

Этот скрипт позволяет вашему приложению сохранять записи ТО, заметки и напоминания в одну таблицу.

## 1. Подготовка
1. Создайте новую **Google Таблицу**.
2. Перейдите в **Расширения** -> **Apps Script**.

## 2. Код скрипта
Удалите всё из редактора и вставьте этот код:

```javascript
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["timestamp", "type", "date", "mileage", "title", "price", "content", "remind_before"]);
  }
  
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    data.timestamp,
    data.type,
    data.date || "",
    data.mileage || "",
    data.title || "",
    data.price || "",
    data.content || "",
    data.remind_before || ""
  ]);
  
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  if (e.parameter.action === 'get') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];
    if (sheet.getLastRow() < 2) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var result = [];
    for (var i = 1; i < data.length; i++) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) { obj[headers[j]] = data[i][j]; }
      result.push(obj);
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 3. Развертывание
1. Нажмите **Начать развертывание** -> **Новое развертывание**.
2. Выберите тип **Веб-приложение**.
3. Установите:
   - "Запуск от имени": **Вы**
   - "Кто имеет доступ": **Все** (Anyone)
4. Нажмите **Развернуть** и подтвердите разрешения.
5. Скопируйте **URL веб-приложения**.

## 4. Подключение
Вставьте полученный URL в файл `books/volvo/records/log.html` в переменную `const SCRIPT_URL = 'ВАШ_URL';`.
