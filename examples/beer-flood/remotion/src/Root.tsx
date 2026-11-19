import { Composition } from "remotion";
import { BeerShort, BEER_FRAMES } from "./videos/beer/BeerShort";
import { TestBox } from "./videos/test/TestBox";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TestBox"
        component={TestBox}
        durationInFrames={10}
        fps={30}
        width={720}
        height={1280}
      />
      <Composition
        id="BeerShort"
        component={BeerShort}
        durationInFrames={BEER_FRAMES}
        fps={30}
        width={720}
        height={1280}
      />
    </>
  );
};
