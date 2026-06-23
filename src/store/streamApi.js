import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const streamApi = createApi({
  reducerPath: "streamApi",
  baseQuery: fetchBaseQuery({
    baseUrl:
      process.env.NEXT_PUBLIC_API_URL || "https://live-world-cup.onrender.com/",
  }),
  endpoints: (builder) => ({
    getSchedule: builder.query({
      query: () => "/api/schedule",
    }),
  }),
});

export const { useGetScheduleQuery } = streamApi;
