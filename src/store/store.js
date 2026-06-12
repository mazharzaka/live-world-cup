import { configureStore } from '@reduxjs/toolkit';
import { streamApi } from './streamApi';

export const store = configureStore({
  reducer: {
    [streamApi.reducerPath]: streamApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(streamApi.middleware),
});
