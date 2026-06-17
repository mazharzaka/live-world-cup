'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Play } from 'lucide-react';

export default function MovieCard({ id, title, poster, targetUrl }) {
  const watchUrl = `/watch?id=${id}&title=${encodeURIComponent(title)}`;

  return (
    <Link href={watchUrl} style={{ textDecoration: 'none', display: 'block' }}>
      <motion.div
        className="movie-card"
        whileHover="hover"
        initial="rest"
        animate="rest"
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        {/* Poster Image */}
        <motion.img
          src={poster}
          alt={title}
          className="movie-card-poster"
          variants={{
            rest: { scale: 1 },
            hover: { scale: 1.08 }
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />

        {/* Play Icon in Center */}
        <motion.div
          className="movie-card-play-icon"
          variants={{
            rest: { opacity: 0, scale: 0.8, translate: '-50% -50%' },
            hover: { opacity: 1, scale: 1, translate: '-50% -50%' }
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        >
          <Play fill="currentColor" size={24} style={{ marginRight: '-2px' }} />
        </motion.div>

        {/* Info Overlay at Bottom */}
        <motion.div
          className="movie-card-overlay"
          variants={{
            rest: { opacity: 0 },
            hover: { opacity: 1 }
          }}
          transition={{ duration: 0.3 }}
        >
          <motion.h3
            className="movie-card-title"
            variants={{
              rest: { y: 15 },
              hover: { y: 0 }
            }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {title}
          </motion.h3>
        </motion.div>
      </motion.div>
    </Link>
  );
}
