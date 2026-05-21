// Shared constants for the cold chain logistics demo
// Both web/ and mobile/ import from here to avoid duplication

// Order/Shipment status labels
export const SHIPMENT_STATUS = {
  planned: { label: '待规划', tag: 'info', color: '#909399' },
  assigned: { label: '已分配', tag: '', color: '#1890ff' },
  loaded: { label: '已装车', tag: '', color: '#722ed1' },
  in_transit: { label: '运输中', tag: 'warning', color: '#fa8c16' },
  arrived: { label: '已到达', tag: '', color: '#67c23a' },
  completed: { label: '已完成', tag: 'success', color: '#13c2c2' },
  exception: { label: '异常', tag: 'danger', color: '#f5222d' }
}

export const ORDER_STATUS = {
  pending: { label: '待确认', tag: 'warning' },
  confirmed: { label: '已确认', tag: 'primary' },
  processing: { label: '处理中', tag: '' },
  in_transit: { label: '运输中', tag: 'warning' },
  delivered: { label: '已送达', tag: 'success' },
  cancelled: { label: '已取消', tag: 'danger' }
}

export const STOP_STATUS = {
  pending: { label: '待配送' },
  arrived: { label: '已到达' },
  delivered: { label: '已送达' }
}

// Alert levels
export const ALERT_LEVEL = {
  yellow: { label: '黄色预警', short: '黄', tag: 'warning' },
  orange: { label: '橙色预警', short: '橙', tag: 'danger' },
  red: { label: '红色预警', short: '红', tag: 'danger' }
}

// Sensor positions
export const SENSOR_POSITION = {
  front: '前部',
  middle: '中部',
  rear: '后部'
}

// Product categories
export const PRODUCT_CATEGORY = {
  tea: '茶叶',
  vegetable: '蔬菜',
  fruit: '水果',
  meat: '肉类',
  other: '其他'
}

// City display names
export const CITY_NAME = {
  shanghai: '上海',
  hangzhou: '杭州'
}

// Temperature thresholds (deviation from required_temp_max, matching backend config)
export const TEMP_THRESHOLDS = {
  YELLOW: 0.5,
  ORANGE: 1.5,
  RED: 2.5
}
