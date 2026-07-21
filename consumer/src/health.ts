import { Request, Response } from 'express';

let isHealthy = false;

export function setHealthy(status: boolean) {
  isHealthy = status;
}

export function healthHandler(req: Request, res: Response) {
  if (isHealthy) {
    res.status(200).json({ status: 'OK' });
  } else {
    res.status(503).json({ status: 'Service Unavailable' });
  }
}
