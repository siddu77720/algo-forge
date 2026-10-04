import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { socket } from '../lib/socket';

export default function Chart({ pair, state }: { pair: string, state: any }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (chartContainerRef.current) {
      const chart = createChart(chartContainerRef.current, {
        autoSize: true,
        layout: {
          background: { type: 'solid' as any, color: '#1e293b' },
          textColor: '#94a3b8',
        },
        grid: {
          vertLines: { color: '#334155' },
          horzLines: { color: '#334155' },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        }
      });
      
      const candlestickSeries = (chart as any).addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });

      chartRef.current = chart;
      seriesRef.current = candlestickSeries;

      fetch(`http://localhost:5000/api/pairs/${encodeURIComponent(pair)}/history`)
        .then(r => r.json())
        .then(d => {
          if (d.history && seriesRef.current) {
            const formatted = d.history.map((c: any) => ({
              time: Math.floor(c.timestamp / 1000) as any,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }));
            seriesRef.current.setData(formatted);
          }
        });

      const handleResize = () => {
        chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
      };
    }
  }, [pair]);

  useEffect(() => {
    const handleCandle = ({ pair: p, candle }: any) => {
      if (p === pair && seriesRef.current && candle) {
        // lightweight-charts needs time in seconds
        const chartCandle = {
          time: Math.floor(candle.timestamp / 1000) as any,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        };
        seriesRef.current.update(chartCandle);
      }
    };

    socket.on('strategy_update', handleCandle);
    return () => {
      socket.off('strategy_update', handleCandle);
    };
  }, [pair]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 px-2">
        <h3 className="text-white font-semibold">{pair} - 1 MINUTE</h3>
        {state?.baseHigh && (
          <span className="text-xs text-blue-400">Base Range: {state.baseLow.toFixed(5)} - {state.baseHigh.toFixed(5)}</span>
        )}
      </div>
      <div ref={chartContainerRef} className="flex-1" />
    </div>
  );
}
