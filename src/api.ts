import { useState, useEffect } from "react";
import { Observable } from "./observable";

type CameraGrabApiMsg = {
  cmd: "grab";
  cam: string;
  button: boolean;
  wait: number | null;
};

type ImuApiMsg = {
  cmd: "imu";
  wait: number | null;
};

type ServerDisconnectMsg = {
  cmd: "disconnect"; // occurs when a second client attempts to connect - switches to newest
};

type ApiMsg = CameraGrabApiMsg | ImuApiMsg | ServerDisconnectMsg;

export class Api {
  waitingOnButton: Observable<boolean>;

  private ws: WebSocket;
  private getPhoto: () => Blob;

  // can't just use "/ws". WebSocket constructor won't accept it.
  // static WS_URL =
  //   "ws://" + document.domain + ":" + window.location.port + "/ws";
  static WS_URL = "ws://" + document.domain + ":8765/ws";

  constructor(ws: WebSocket, getPhoto: () => Blob) {
    this.ws = ws;
    this.waitingOnButton = new Observable(false as boolean);
    this.getPhoto = getPhoto;

    ws.onmessage = async ({ data }: { data: string }) =>
      this.onMsg(JSON.parse(data) as ApiMsg);
  }

  private onMsg(msg: ApiMsg) {
    switch (msg.cmd) {
      case "grab":
        if (msg.button) {
          console.log("waiting");
          this.waitingOnButton.set(true);
        } else {
          this.getPhoto();
        }
        break;

      case "imu":
        this.send(null);
        break;

      case "disconnect":
        this.ws.close();
        throw new Error("Another client device has taken control of websocket");

      default:
        throw new Error(`Unhandled Api message ${msg}`);
    }
  }

  private send(msg: any) {
    console.log("sending", { msg, readyState: this.ws.readyState });
    this.ws.send(msg instanceof Blob ? msg : JSON.stringify(msg));
  }

  ready() {
    this.send({ ready: true });
  }

  sendPhoto() {
    this.send(this.getPhoto());
  }
}

export function useApi(params: ConstructorParameters<typeof Api>[1]) {
  const [api, setApi] = useState<Api | Error | null>(null);

  useEffect(() => {
    try {
      const ws = new WebSocket(Api.WS_URL);
      ws.onopen = () => setApi(new Api(ws, params));
      ws.onclose = () => setApi(null);
      return ws.close; // effect cleanup handler
    } catch (e) {
      setApi(e); // set the connection error to show users
    }
  }, [params]);

  return api;
}
