module.exports = {
  PORT: 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'huinong-cold-chain-demo-secret-key-2024',
  JWT_EXPIRES_IN: '24h',

  // Sensor simulation settings
  SIMULATION: {
    INTERVAL_MS: 3000,       // Generate readings every 3 seconds
    ANOMALY_CHANCE: 0.12,    // 12% chance of temperature anomaly per reading batch
    ANOMALY_RANGE: [0.5, 3.0] // degrees C drift per anomaly step (allows red alerts to trigger naturally)
  },

  // Alert thresholds (degrees C deviation from threshold)
  // Matching planning doc §4.2.1: Yellow>0.5°C, Orange>1.5°C, Red>2.5°C
  ALERT: {
    YELLOW: 0.5, // >0.5°C deviation = yellow warning → 推送司机APP
    ORANGE: 1.5, // >1.5°C deviation = orange warning → 通知调度中心
    RED: 2.5     // >2.5°C deviation = red alert → 应急调度启动
  },

  // Product temperature requirements
  PRODUCT_TEMPS: {
    vegetable: { min: 0, max: 4 },
    fruit: { min: 0, max: 4 },
    meat: { min: 0, max: 2 },
    tea: { min: 0, max: 8 }
  }
};
