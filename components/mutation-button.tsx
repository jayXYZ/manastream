import { Button } from "./ui/button";
import { useState } from "react";

export default function MutationButton<TParams = unknown>({
  mutation,
  mutationParams,
  children,
  loadingText = "Loading...",
  disabled = false,
  className,
}: {
  mutation: (params: TParams) => Promise<void | null>;
  mutationParams: TParams;
  children: React.ReactNode;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
}): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const handleMutationClick = async () => {
    try {
      setIsLoading(true);
      await mutation(mutationParams);
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };
  if (isLoading) {
    return (
      <Button disabled={disabled} className={className}>
        {loadingText}
      </Button>
    );
  }
  return (
    <Button
      onClick={handleMutationClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </Button>
  );
}
