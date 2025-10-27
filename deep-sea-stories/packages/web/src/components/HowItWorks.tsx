import type { FC } from "react";
import { Button, type ButtonProps } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTrigger,
} from "./ui/dialog";

const HowItWorks: FC<ButtonProps> = ({ variant, ...props }) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant={variant ?? "outline"} {...props}>
        How does it work?
      </Button>
    </DialogTrigger>
    <DialogContent className="bg-accent p-12 max-w-4xl rounded-4xl">
      <DialogHeader className="font-display text-2xl pb-4">
        How to play Deep Sea Stories?
      </DialogHeader>
      <DialogDescription className="text-lg text-primary flex flex-col gap-4 overflow-auto max-h-[50vh]">
        <p>
          “Deep Sea Stories” are a loose adaptation of the well-known game
          called “Dark Stories”. With the help of an AI agent and room you can
          play together with your friends fully online.
        </p>
        <p>
          Choose one of four predefined scenarios that will circle around sea
          stories and listen the background of it, giving you some clues and
          directions to find the real reason and perpetrator of the event. Then,
          you can ask questions and get “yes” or “no” responses from the
          Storyteller that will be your only way to gather more clues.
        </p>
        <p>
          If you are ready to guess the story and win the game, say out loud
          “I’m guessing now...” and say your deduced reasons. If you are right,
          Storyteller is going to stop the game and congratulate you. If you
          missed something, Storyteller is going to continue the game and let
          you ask more questions.
        </p>
      </DialogDescription>
    </DialogContent>
  </Dialog>
);

export default HowItWorks;
