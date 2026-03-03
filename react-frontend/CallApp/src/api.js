// src/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://192.168.244.113:8000/api', // change if your Laravel backend runs elsewhere
});

export default api;
