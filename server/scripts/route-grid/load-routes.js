/* Загрузка сгенерированной сетки маршрутов в базу (mongosh-скрипт).
   Старые маршруты сохраняются в коллекцию routes_backup_handdrawn.

   Локально (Mongo в Docker):
     docker cp server/scripts/route-grid/output/routes.generated.json <container>:/tmp/
     docker cp server/scripts/route-grid/load-routes.js <container>:/tmp/
     docker exec <container> mongosh goodzone --quiet --file /tmp/load-routes.js
   На прод запускать только после ревью и явного решения. */
const fs = require("fs");
const generated = JSON.parse(fs.readFileSync("/tmp/routes.generated.json", "utf8"));

// бэкап нарисованных вручную (если ещё не делали)
const backupExists = db.getCollectionNames().includes("routes_backup_handdrawn");
if (!backupExists) {
  db.routes.aggregate([{ $out: "routes_backup_handdrawn" }]);
  print(`бэкап: ${db.routes_backup_handdrawn.countDocuments()} старых маршрутов`);
} else {
  print("бэкап уже существует, не перезаписываю");
}

db.routes.deleteMany({});
const docs = generated.map((r) => ({
  name: r.name,
  fromPointId: new ObjectId(r.fromPointId),
  toPointId: new ObjectId(r.toPointId),
  coords: r.coords,
  createdAt: new Date(),
  updatedAt: new Date(),
  __v: 0,
}));
db.routes.insertMany(docs);
print(`загружено маршрутов: ${db.routes.countDocuments()}`);
