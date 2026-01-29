#!/bin/bash
# MongoDB Setup Script for MockMail

# Create MongoDB user and database
mongo <<MONGOEOF
use admin
db.createUser({
  user: "admin",
  pwd: "CHANGE_THIS_PASSWORD",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})

use mockmail
db.createUser({
  user: "app_user",
  pwd: "CHANGE_THIS_PASSWORD",
  roles: [ { role: "readWrite", db: "mockmail" } ]
})
MONGOEOF

echo "MongoDB users created successfully"
