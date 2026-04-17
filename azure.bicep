{
  "$schema": "http://json.schemastore.org/webzig",
  "name": "liftit",
  "subscription": "your-subscription-id",
  "location": "eastus",
  "resourceGroup": "liftit-rg",
  "slots": {
    "staging": {}
  },
  " variables": {
    "appServicePlanName": "liftit-plan",
    "mysqlSkuName": "B_Gen5_2",
    "mysqlTier": "Basic"
  },
  "resources": [
    {
      "type": "Microsoft.Web/serverfarms",
      "apiVersion": "2021-02-01",
      "name": "[variables('appServicePlanName')]",
      "location": "[resourceGroup().location]",
      "sku": {
        "name": "B1",
        "tier": "Basic"
      }
    },
    {
      "type": "Microsoft.Web/sites",
      "apiVersion": "2021-02-01",
      "name": "liftit-app",
      "location": "[resourceGroup().location]",
      "dependsOn": [
        "[resourceId('Microsoft.Web/serverfarms', variables('appServicePlanName'))]"
      ],
      "properties": {
        "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', variables('appServicePlanName'))]",
        "siteConfig": {
          "appSettings": [
            {
              "name": "DATABASE_URL",
              "value": "[concat('mysql://', 'liftit', ':', 'password', '@', 'liftit-mysql.mysql.database.azure.com', ':3306', '/liftit')]"
            },
            {
              "name": "JWT_SECRET",
              "value": "[parameters('jwtSecret')]"
            },
            {
              "name": "ANTHROPIC_API_KEY",
              "value": "[parameters('anthropicApiKey')]"
            },
            {
              "name": "VITE_API_URL",
              "value": "/api"
            }
          ]
        }
      }
    },
    {
      "type": "Microsoft.DBforMySQL/servers",
      "apiVersion": "2021-05-01",
      "name": "liftit-mysql",
      "location": "[resourceGroup().location]",
      "sku": {
        "name": "[variables('mysqlSkuName')]",
        "tier": "[variables('mysqlTier')]"
      },
      "properties": {
        "createMode": "Default",
        "version": "8.0"
      }
    },
    {
      "type": "Microsoft.DBforMySQL/databases",
      "apiVersion": "2021-05-01",
      "name": "liftit",
      "dependsOn": [
        "[resourceId('Microsoft.DBforMySQL/servers', 'liftit-mysql')]"
      ],
      "properties": {
        "charset": "utf8mb4",
        "collation": "utf8mb4_unicode_ci"
      }
    }
  ]
}
