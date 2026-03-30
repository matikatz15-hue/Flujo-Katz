interface Props {
  message: string;
}

export function ErrorMessage({ message }: Props) {
  return <div className="error">{message}</div>;
}
